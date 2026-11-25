// Supabase Edge Function: process-edna
// Deploy via: supabase functions deploy process-edna
// Processes uploaded eDNA dataset metadata & computes Shannon, Simpson, and Pielou indices server-side.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface TaxonCount {
  scientific_name: string;
  read_count: number;
}

function computeBiodiversityMetrics(taxa: TaxonCount[]) {
  const valid = taxa.filter((t) => t.read_count > 0);
  const speciesRichness = valid.length;
  const totalReads = valid.reduce((acc, t) => acc + t.read_count, 0);

  if (speciesRichness === 0 || totalReads === 0) {
    return {
      species_richness: 0,
      total_reads: 0,
      shannon_index: 0,
      simpson_index: 0,
      simpson_diversity: 0,
      pielou_evenness: null,
      relative_abundances: [],
    };
  }

  let shannon = 0;
  let simpsonD = 0;
  const relativeAbundances = valid.map((t) => {
    const pi = t.read_count / totalReads;
    shannon += -1 * pi * Math.log(pi);
    simpsonD += pi * pi;
    return {
      scientific_name: t.scientific_name,
      read_count: t.read_count,
      relative_abundance: Number(pi.toFixed(6)),
    };
  });

  const pielou = speciesRichness > 1 ? shannon / Math.log(speciesRichness) : null;

  return {
    species_richness: speciesRichness,
    total_reads: totalReads,
    shannon_index: Number(shannon.toFixed(4)),
    simpson_index: Number(simpsonD.toFixed(4)),
    simpson_diversity: Number((1 - simpsonD).toFixed(4)),
    pielou_evenness: pielou !== null ? Number(pielou.toFixed(4)) : null,
    relative_abundances: relativeAbundances,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const { dataset_id, firebase_uid } = await req.json();
    if (!dataset_id || !firebase_uid) {
      return new Response(JSON.stringify({ error: 'Missing dataset_id or firebase_uid' }), { status: 400 });
    }

    const { data: results, error } = await supabase
      .from('taxonomic_results')
      .select('scientific_name, read_count')
      .eq('dataset_id', dataset_id)
      .eq('firebase_uid', firebase_uid);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    const metrics = computeBiodiversityMetrics(results ?? []);
    const { data: inserted, error: insertError } = await supabase
      .from('biodiversity_metrics')
      .insert({
        dataset_id,
        firebase_uid,
        ...metrics,
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ metrics: inserted }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

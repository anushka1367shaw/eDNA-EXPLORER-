import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Database,
  FileSpreadsheet,
  FileText,
  Menu,
  Microscope,
  Moon,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LogoMark } from './LogoMark';

interface LandingPageProps {
  onNavigate: (route: string) => void;
}

type FooterDocKey = 'about' | 'contact' | 'privacy' | 'terms' | 'docs' | null;

const FOOTER_DOCS: Record<Exclude<FooterDocKey, null>, { title: string; body: string[] }> = {
  about: {
    title: 'About eDNA Explorer',
    body: [
      'eDNA Explorer is a scientific research workspace engineered for ecologists, conservation biologists, and environmental laboratories working with environmental DNA (eDNA) metabarcoding datasets.',
      'By combining validated sequence ingestion, NCBI Taxonomy and BOLD reference lookups, standardized biodiversity index calculations, and cautious AI-assisted interpretation, researchers can move cleanly from raw field samples to reproducible conservation reports.',
    ],
  },
  contact: {
    title: 'Research & Support Contact',
    body: [
      'For institutional onboarding, custom reference library integrations, or technical inquiries regarding eDNA Explorer, contact our bioinformatics engineering desk at research-support@edna-explorer.org.',
      'If you encounter dataset validation issues or authentication errors, include your sample format (.csv, .tsv, .fasta, .fastq) and timestamp so our team can assist promptly.',
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    body: [
      'User identity records (name, institution, and email address) are isolated in Firebase Firestore under strict owner-only access rules. Passwords are never stored in application databases.',
      'Uploaded eDNA sequence files and biodiversity analysis outputs are scoped strictly to the authenticated researcher UID and are never shared publicly or across accounts.',
    ],
  },
  terms: {
    title: 'Terms and Conditions',
    body: [
      'eDNA Explorer provides bioinformatics parsing, ecological diversity calculations, and interpretive AI summaries for research and educational use.',
      'Researchers remain responsible for validating wet-lab controls, PCR blanks, and taxonomic assignments against primary reference databases before publishing conservation or regulatory findings. Demonstration mode outputs are illustrative only.',
    ],
  },
  docs: {
    title: 'Platform Documentation',
    body: [
      'Supported Formats: CSV/TSV abundance or sequence tables, FASTA (.fasta, .fa, .fna), FASTQ (.fastq, .fq), and plain sequence TXT files up to 25 MB.',
      'Biodiversity Formulas: Shannon-Wiener Index H\' = -Σ(pi × ln(pi)), Simpson Dominance D = Σ(pi²), Simpson Diversity (1 - D), and Pielou\'s Evenness J = H\' / ln(S), where pi is relative read abundance and S is species richness.',
      'Important Limitation: eDNA sequence read counts reflect amplified DNA fragment frequencies and are not automatically equivalent to organism biomass or population abundance.',
    ],
  },
};

export function LandingPage({ onNavigate }: LandingPageProps) {
  const { firebaseUser, theme, toggleTheme } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDoc, setActiveDoc] = useState<FooterDocKey>(null);

  const features = [
    {
      icon: FileSpreadsheet,
      title: 'DNA Dataset Upload',
      description:
        'Ingest CSV, TSV, FASTA, FASTQ, and TXT files with instant structural validation, 20-row tabular previews, and GC/Phred quality statistics.',
    },
    {
      icon: Microscope,
      title: 'Taxonomic Identification',
      description:
        'Inspect full 8-level taxonomic hierarchies (Domain to Species) with NCBI Taxonomy & BOLD live verification and clearly labelled demonstration screening.',
    },
    {
      icon: BarChart3,
      title: 'Biodiversity Assessment',
      description:
        'Compute Species Richness, Shannon Diversity (H\'), Simpson Index (D & 1-D), and Pielou\'s Evenness (J) with multi-sample comparison charts.',
    },
    {
      icon: Database,
      title: 'Species Distribution',
      description:
        'Visualize relative read abundance across phyla, classes, and sampling sites while tracking ecological caveats around read-count interpretation.',
    },
    {
      icon: FileText,
      title: 'Scientific Reports',
      description:
        'Export structured PDF, CSV, and print-ready research reports containing sample metadata, diversity metrics, methodology, and limitations.',
    },
    {
      icon: Sparkles,
      title: 'AI-Powered Insights',
      description:
        'Query an ecological AI assistant grounded strictly in your actual dataset metrics, separating direct observations from cautious interpretations.',
    },
  ];

  const workflowSteps = [
    {
      step: '01',
      title: 'Upload environmental DNA datasets',
      detail: 'Drag and drop FASTA, FASTQ, CSV, TSV, or TXT files alongside field sample location, date, and substrate metadata.',
    },
    {
      step: '02',
      title: 'Process and validate the dataset',
      detail: 'Inspect parsed nucleotide lengths, GC content, Phred quality scores, or the first 20 rows before running analysis.',
    },
    {
      step: '03',
      title: 'Identify taxonomic groups and species',
      detail: 'Verify annotations via NCBI Taxonomy / BOLD APIs or test sequences in clearly labelled demonstration reference mode.',
    },
    {
      step: '04',
      title: 'Calculate biodiversity metrics',
      detail: 'Run mathematically rigorous Shannon, Simpson, Pielou evenness, and relative abundance calculations across samples.',
    },
    {
      step: '05',
      title: 'Generate visualizations and reports',
      detail: 'Explore interactive charts, ask the AI scientific assistant about anomalies, and export PDF or CSV reports.',
    },
  ];

  return (
    <div id="home" className="min-h-screen bg-[#F4F8F5] dark:bg-[#071D17] text-[#063B2B] dark:text-[#ECF5F0]">
      {/* Top Bar: Clean 3-zone contract */}
      <header className="sticky top-0 z-40 border-b border-[#D8E5DD] dark:border-[#143A2F] bg-[#F4F8F5]/95 dark:bg-[#071D17]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand */}
          <a
            href="#home"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#063B2B] dark:text-white whitespace-nowrap shrink-0"
          >
            <LogoMark size={30} />
            <span className="font-display">eDNA Explorer</span>
          </a>

          {/* Zone 2: Concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#1E4D3D] dark:text-[#B9D8CA]">
            <a href="#home" className="hover:text-[#087A50] dark:hover:text-[#55D6C2] transition-colors whitespace-nowrap shrink-0">
              Home
            </a>
            <a href="#about" className="hover:text-[#087A50] dark:hover:text-[#55D6C2] transition-colors whitespace-nowrap shrink-0">
              About
            </a>
            <a href="#features" className="hover:text-[#087A50] dark:hover:text-[#55D6C2] transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-[#087A50] dark:hover:text-[#55D6C2] transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#research" className="hover:text-[#087A50] dark:hover:text-[#55D6C2] transition-colors whitespace-nowrap shrink-0">
              Research
            </a>
          </nav>

          {/* Zone 3: Primary action + mobile toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void toggleTheme()}
              aria-label="Toggle color theme"
              className="p-2 rounded-lg text-[#1E4D3D] dark:text-[#B9D8CA] hover:bg-[#E4EFE8] dark:hover:bg-[#0F3127] transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {firebaseUser ? (
              <button
                type="button"
                onClick={() => onNavigate('/dashboard')}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[#087A50] text-white hover:bg-[#063B2B] transition-colors whitespace-nowrap shrink-0"
              >
                Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('/login')}
                  className="px-3 py-2 text-sm font-medium text-[#063B2B] dark:text-[#ECF5F0] hover:text-[#087A50] dark:hover:text-[#55D6C2] transition-colors whitespace-nowrap shrink-0"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/register')}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[#087A50] text-white hover:bg-[#063B2B] transition-colors whitespace-nowrap shrink-0"
                >
                  Register
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 rounded-lg text-[#063B2B] dark:text-white hover:bg-[#E4EFE8] dark:hover:bg-[#0F3127]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] px-4 py-4 space-y-2">
            <a href="#home" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium">
              Home
            </a>
            <a href="#about" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium">
              About
            </a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium">
              Features
            </a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium">
              How It Works
            </a>
            <a href="#research" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium">
              Research
            </a>
            <div className="pt-2 border-t border-[#D8E5DD] dark:border-[#143A2F] flex gap-3">
              {firebaseUser ? (
                <button
                  type="button"
                  onClick={() => onNavigate('/dashboard')}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-[#087A50] text-white text-sm font-medium"
                >
                  Open Dashboard
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate('/login')}
                    className="flex-1 py-2.5 px-4 rounded-lg border border-[#D8E5DD] dark:border-[#143A2F] text-sm font-medium"
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/register')}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-[#087A50] text-white text-sm font-medium"
                  >
                    Register
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-xs font-mono tracking-wider text-[#087A50] dark:text-[#55D6C2] mb-4">
              Discover · Identify · Conserve
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#063B2B] dark:text-white leading-[1.12] [text-wrap:balance]">
              Discover the Hidden Biodiversity Around Us
            </h1>
            <p className="mt-5 text-base sm:text-lg text-[#2E5547] dark:text-[#B9D8CA] leading-relaxed max-w-xl">
              Explore environmental DNA datasets, identify species and understand biodiversity through intelligent scientific analysis.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate(firebaseUser ? '/dashboard' : '/register')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#087A50] text-white font-medium text-sm hover:bg-[#063B2B] transition-colors whitespace-nowrap shrink-0"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#features"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#0B271F] text-[#063B2B] dark:text-[#ECF5F0] font-medium text-sm hover:border-[#087A50] transition-colors whitespace-nowrap shrink-0"
              >
                Explore Features
              </a>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[280px] rounded-xl overflow-hidden border border-[#D8E5DD] dark:border-[#143A2F] bg-[#063B2B]">
              <img
                src="/src/assets/images/hero_forest_edna_1795627010762.jpg"
                alt="Forest river ecosystem illustrating environmental DNA water sampling and biodiversity"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Scientific Capabilities Strip (placed cleanly below Hero split) */}
        <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4 border-t border-[#D8E5DD] dark:border-[#143A2F] pt-8">
          <div>
            <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">Supported Formats</p>
            <p className="mt-1 font-mono text-lg font-semibold text-[#063B2B] dark:text-white tabular-nums">
              CSV · TSV · FASTA · FASTQ
            </p>
          </div>
          <div>
            <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">Diversity Indices</p>
            <p className="mt-1 font-mono text-lg font-semibold text-[#063B2B] dark:text-white tabular-nums">
              Shannon · Simpson · Pielou
            </p>
          </div>
          <div>
            <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">Reference Authorities</p>
            <p className="mt-1 font-mono text-lg font-semibold text-[#063B2B] dark:text-white tabular-nums">
              NCBI Taxonomy · BOLD
            </p>
          </div>
          <div>
            <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">Scientific Exports</p>
            <p className="mt-1 font-mono text-lg font-semibold text-[#063B2B] dark:text-white tabular-nums">
              PDF · CSV · Print
            </p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="border-t border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <div className="rounded-xl overflow-hidden border border-[#D8E5DD] dark:border-[#143A2F]">
              <img
                src="/src/assets/images/about_edna_sampling_1795627011361.jpg"
                alt="Field ecologist collecting environmental DNA water sample in forest stream"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover aspect-[4/3]"
              />
            </div>
          </div>
          <div className="lg:col-span-7">
            <p className="text-xs font-mono text-[#087A50] dark:text-[#55D6C2] mb-2">About Environmental DNA</p>
            <h2 className="text-3xl font-bold text-[#063B2B] dark:text-white [text-wrap:balance]">
              Non-Invasive Biodiversity Monitoring from Trace Genetic Material
            </h2>
            <p className="mt-4 text-base text-[#2E5547] dark:text-[#B9D8CA] leading-relaxed">
              Every organism sheds trace genetic material—skin cells, mucus, spores, pollen, and metabolic waste—into surrounding water, soil, sediment, and air. By filtering and sequencing this environmental DNA (eDNA), ecologists can detect elusive aquatic, amphibian, plant, and invertebrate species without capturing or disturbing wildlife.
            </p>
            <p className="mt-4 text-base text-[#2E5547] dark:text-[#B9D8CA] leading-relaxed">
              eDNA Explorer bridges raw field sequencing files and ecological assessment: validating dataset structure, cross-referencing taxonomic authorities, calculating community diversity indices, and documenting methodological limitations transparently.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="border-t border-[#D8E5DD] dark:border-[#143A2F] py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-mono text-[#087A50] dark:text-[#55D6C2] mb-2">Platform Capabilities</p>
            <h2 className="text-3xl font-bold text-[#063B2B] dark:text-white">
              End-to-End Scientific Workflow for eDNA Research
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#E6F4EC] dark:bg-[#11382C] flex items-center justify-center text-[#087A50] dark:text-[#55D6C2]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[#063B2B] dark:text-white">{f.title}</h3>
                  <p className="mt-2 text-sm text-[#355E4F] dark:text-[#B9D8CA] leading-relaxed">
                    {f.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="border-t border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-mono text-[#087A50] dark:text-[#55D6C2] mb-2">Analysis Pipeline</p>
            <h2 className="text-3xl font-bold text-[#063B2B] dark:text-white">How eDNA Explorer Works</h2>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-5 gap-6">
            {workflowSteps.map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-[#F4F8F5] dark:bg-[#071D17] p-5"
              >
                <span className="font-mono text-sm font-semibold text-[#087A50] dark:text-[#9BE564]">
                  Step {item.step}
                </span>
                <h3 className="mt-2 text-base font-semibold text-[#063B2B] dark:text-white leading-snug">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs text-[#355E4F] dark:text-[#B9D8CA] leading-relaxed">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Research & Taxonomic Integrity Section */}
      <section id="research" className="border-t border-[#D8E5DD] dark:border-[#143A2F] py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <p className="text-xs font-mono text-[#087A50] dark:text-[#55D6C2] mb-2">Scientific Rigor</p>
            <h2 className="text-3xl font-bold text-[#063B2B] dark:text-white [text-wrap:balance]">
              Transparent Metrics &amp; Reproducible Ecological Assessments
            </h2>
            <p className="mt-4 text-base text-[#2E5547] dark:text-[#B9D8CA] leading-relaxed">
              eDNA Explorer enforces strict boundaries between verified taxonomic lookups, user-supplied annotations, and demonstration screening. Every diversity calculation exposes exact formulas and sample sizes, and explicitly notes that read counts are influenced by primer bias and shedding rates rather than equaling organism biomass.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-4">
                <p className="font-mono font-semibold text-[#063B2B] dark:text-white">H&apos; = -Σ(pi × ln(pi))</p>
                <p className="mt-1 text-xs text-[#4B6F61] dark:text-[#8FB7A6]">
                  Shannon-Wiener Diversity Index combining richness and evenness
                </p>
              </div>
              <div className="rounded-lg border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-4">
                <p className="font-mono font-semibold text-[#063B2B] dark:text-white">D = Σ(pi²) &amp; J = H&apos; / ln(S)</p>
                <p className="mt-1 text-xs text-[#4B6F61] dark:text-[#8FB7A6]">
                  Simpson Dominance and Pielou&apos;s Evenness Index across communities
                </p>
              </div>
            </div>
            <div className="mt-8">
              <button
                type="button"
                onClick={() => onNavigate(firebaseUser ? '/dashboard' : '/register')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#087A50] text-white text-sm font-medium hover:bg-[#063B2B] transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                Start Research Workspace
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-xl overflow-hidden border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F]">
              <img
                src="/src/assets/images/species_biome_forest_1795627011768.jpg"
                alt="Scientific illustration plate of tree frog, salmonid fish, fern frond, and stonefly larva"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover aspect-[4/3]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <LogoMark size={28} />
            <div>
              <p className="font-display font-bold text-sm text-[#063B2B] dark:text-white">eDNA Explorer</p>
              <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">Discover · Identify · Conserve</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-[#2E5547] dark:text-[#B9D8CA]">
            <button type="button" onClick={() => setActiveDoc('about')} className="hover:text-[#087A50] dark:hover:text-[#55D6C2]">
              About Us
            </button>
            <button type="button" onClick={() => setActiveDoc('contact')} className="hover:text-[#087A50] dark:hover:text-[#55D6C2]">
              Contact
            </button>
            <button type="button" onClick={() => setActiveDoc('privacy')} className="hover:text-[#087A50] dark:hover:text-[#55D6C2]">
              Privacy Policy
            </button>
            <button type="button" onClick={() => setActiveDoc('terms')} className="hover:text-[#087A50] dark:hover:text-[#55D6C2]">
              Terms and Conditions
            </button>
            <button type="button" onClick={() => setActiveDoc('docs')} className="hover:text-[#087A50] dark:hover:text-[#55D6C2]">
              Documentation
            </button>
          </div>
        </div>
      </footer>

      {/* Footer Documentation Modal */}
      {activeDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-lg w-full rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-[#063B2B] dark:text-white">{FOOTER_DOCS[activeDoc].title}</h3>
              <button
                type="button"
                onClick={() => setActiveDoc(null)}
                aria-label="Close modal"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-[#2E5547] dark:text-[#B9D8CA] leading-relaxed">
              {FOOTER_DOCS[activeDoc].body.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveDoc(null)}
                className="px-4 py-2 rounded-lg bg-[#087A50] text-white text-sm font-medium hover:bg-[#063B2B]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Industry presets for structured knowledge collection.
 * Pre-populates the onboarding form based on the contractor's trade.
 */

export interface IndustryPreset {
  label: string;
  services: Array<{ name: string; priceRangeMin: number; priceRangeMax: number }>;
  commonFaqs: Array<{ question: string; answer: string }>;
  dontDo: string[];
  neverSay: string[];
}

export const industryPresets: Record<string, IndustryPreset> = {
  plumbing: {
    label: 'Plumbing',
    services: [
      { name: 'Drain cleaning', priceRangeMin: 150, priceRangeMax: 400 },
      { name: 'Water heater repair', priceRangeMin: 200, priceRangeMax: 800 },
      { name: 'Water heater replacement', priceRangeMin: 1500, priceRangeMax: 4000 },
      { name: 'Pipe repair', priceRangeMin: 200, priceRangeMax: 1500 },
      { name: 'Faucet installation', priceRangeMin: 150, priceRangeMax: 500 },
      { name: 'Toilet repair/replacement', priceRangeMin: 150, priceRangeMax: 600 },
      { name: 'Sewer line repair', priceRangeMin: 1000, priceRangeMax: 5000 },
    ],
    commonFaqs: [
      { question: 'Do you offer emergency service?', answer: '' },
      { question: 'How quickly can you come out?', answer: '' },
      { question: 'Do you provide free estimates?', answer: '' },
      { question: 'Are you licensed and insured?', answer: '' },
      { question: 'Do you warranty your work?', answer: '' },
    ],
    dontDo: ['Gas line work', 'Well pump systems', 'Irrigation/sprinklers'],
    neverSay: [
      'Never guarantee same-day service',
      'Never diagnose problems over text without seeing them',
      'Never promise exact pricing without an in-person estimate',
    ],
  },
  hvac: {
    label: 'HVAC',
    services: [
      { name: 'AC repair', priceRangeMin: 200, priceRangeMax: 800 },
      { name: 'Furnace repair', priceRangeMin: 200, priceRangeMax: 800 },
      { name: 'AC installation', priceRangeMin: 3000, priceRangeMax: 8000 },
      { name: 'Furnace installation', priceRangeMin: 2500, priceRangeMax: 6000 },
      { name: 'Duct cleaning', priceRangeMin: 300, priceRangeMax: 600 },
      { name: 'Maintenance tune-up', priceRangeMin: 100, priceRangeMax: 200 },
    ],
    commonFaqs: [
      { question: 'How often should I get maintenance?', answer: '' },
      { question: 'Do you work with all HVAC brands?', answer: '' },
      { question: 'How long does an installation take?', answer: '' },
      { question: 'Do you offer financing?', answer: '' },
      { question: 'What happens during a tune-up?', answer: '' },
    ],
    dontDo: ['Commercial systems', 'Geothermal systems', 'Gas fireplace installation'],
    neverSay: [
      'Never guarantee same-day service',
      'Never diagnose HVAC problems over text',
      'Never promise energy savings percentages',
    ],
  },
  electrical: {
    label: 'Electrical',
    services: [
      { name: 'Outlet/switch repair', priceRangeMin: 100, priceRangeMax: 300 },
      { name: 'Panel upgrade', priceRangeMin: 1500, priceRangeMax: 4000 },
      { name: 'Lighting installation', priceRangeMin: 150, priceRangeMax: 800 },
      { name: 'EV charger installation', priceRangeMin: 800, priceRangeMax: 2500 },
      { name: 'Wiring repair', priceRangeMin: 200, priceRangeMax: 1500 },
      { name: 'Generator installation', priceRangeMin: 3000, priceRangeMax: 10000 },
    ],
    commonFaqs: [
      { question: 'Are you licensed and bonded?', answer: '' },
      { question: 'Do you pull permits?', answer: '' },
      { question: 'Can you work with aluminum wiring?', answer: '' },
      { question: 'Do you offer free estimates?', answer: '' },
      { question: 'How long does a panel upgrade take?', answer: '' },
    ],
    dontDo: ['Solar panel installation', 'Smart home wiring', 'Commercial electrical'],
    neverSay: [
      'Never advise DIY electrical work',
      'Never guarantee pricing without seeing the job',
      'Never discuss insurance or code violation implications',
    ],
  },
  roofing: {
    label: 'Roofing',
    services: [
      { name: 'Roof repair', priceRangeMin: 300, priceRangeMax: 1500 },
      { name: 'Roof replacement (asphalt)', priceRangeMin: 5000, priceRangeMax: 15000 },
      { name: 'Roof replacement (metal)', priceRangeMin: 8000, priceRangeMax: 25000 },
      { name: 'Gutter installation', priceRangeMin: 800, priceRangeMax: 3000 },
      { name: 'Roof inspection', priceRangeMin: 0, priceRangeMax: 200 },
      { name: 'Skylight installation', priceRangeMin: 1000, priceRangeMax: 3000 },
    ],
    commonFaqs: [
      { question: 'How long does a roof last?', answer: '' },
      { question: 'Do you handle insurance claims?', answer: '' },
      { question: 'Can you do emergency tarping?', answer: '' },
      { question: 'What roofing materials do you recommend?', answer: '' },
      { question: 'Do you offer a warranty?', answer: '' },
    ],
    dontDo: ['Flat/commercial roofing', 'Solar installation', 'Chimney repair'],
    neverSay: [
      'Never guarantee insurance claim approval',
      'Never promise exact timeline (weather dependent)',
      'Never advise climbing on roof for inspection',
    ],
  },
  general: {
    label: 'General Contractor / Handyman',
    services: [
      { name: 'General repair', priceRangeMin: 100, priceRangeMax: 500 },
      { name: 'Drywall repair', priceRangeMin: 150, priceRangeMax: 600 },
      { name: 'Painting (interior)', priceRangeMin: 300, priceRangeMax: 3000 },
      { name: 'Deck repair/build', priceRangeMin: 500, priceRangeMax: 5000 },
      { name: 'Door/window installation', priceRangeMin: 200, priceRangeMax: 1000 },
    ],
    commonFaqs: [
      { question: 'What areas do you serve?', answer: '' },
      { question: 'Do you offer free estimates?', answer: '' },
      { question: 'How quickly can you start?', answer: '' },
      { question: 'Are you licensed?', answer: '' },
      { question: 'Do you clean up after the job?', answer: '' },
    ],
    dontDo: [],
    neverSay: [
      'Never guarantee completion dates without seeing the job',
      'Never promise exact pricing over text',
    ],
  },
};

export const industryOptions = Object.entries(industryPresets).map(([key, preset]) => ({
  value: key,
  label: preset.label,
}));

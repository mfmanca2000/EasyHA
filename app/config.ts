export const ENTITIES = {
  solar: {
    panels: [
      { id: 'sensor.sunology_power', name: 'Sunology' },
      { id: 'sensor.powerstream_inverter_output_watts', name: 'PowerStream' },
      { id: 'sensor.bluetti_dc_input', name: 'Bluetti' },
    ],
    totalPower: 'sensor.solar_power_total',
    energyToday: 'sensor.solar_energy_total_final',
  },
  grid: {
    importPower: 'sensor.power_import',
    exportPower: 'sensor.power_export',
    // Add entity IDs below when available, e.g. 'sensor.energy_import_today'
    importEnergy: null as string | null,
    exportEnergy: null as string | null,
  },
  battery: {
    tesla: 'sensor.electra_battery',
  },
  lights: [
    { id: 'light.soggiorno_divano', name: 'Soggiorno Divano' },
    { id: 'light.primo_piano_up', name: 'Primo Piano ↑' },
    { id: 'light.primo_piano_down', name: 'Primo Piano ↓' },
    { id: 'light.secondo_piano_up', name: 'Secondo Piano ↑' },
    { id: 'light.secondo_piano_down', name: 'Secondo Piano ↓' },
    { id: 'light.terzo_piano_up', name: 'Terzo Piano ↑' },
    { id: 'light.terzo_piano_down', name: 'Terzo Piano ↓' },
    { id: 'light.studio_1_light_2', name: 'Studio 1' },
    { id: 'light.studio_2_light', name: 'Studio 2' },
    { id: 'light.led_angolo', name: 'LED Angolo' },
    { id: 'light.led_orologio', name: 'LED Orologio' },
  ],
} as const;

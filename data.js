/* Rule and reference data for the Air Permit Engineering Toolkit.
 * Each block names its source. Update this file when the Air District amends a rule or fee schedule. */
(function (root) {
  'use strict';
  const DATA = {
    version: 'Data checked November 15, 2026: Regulation 3 fees effective July 1, 2026 (FY 2026-27); Regulation 2-2 and 2-5 as listed in each source line.',

    nsr: {
      bactLbDay: 10,
      offsets: [
        { label: 'NOx and POC offsets, 2-2-302.1', pols: ['NOx', 'POC'], tpy: 10, below: 35, then: 'Offsets at 1:1 for the increase, normally from the Small Facility Banking Account.' },
        { label: 'NOx and POC offsets, 2-2-302.2', pols: ['NOx', 'POC'], tpy: 35, ge: true, then: 'Federally enforceable offsets at 1.15:1 for the un-offset cumulative increase since the baseline date, and reimbursement of the Small Facility Banking Account.' },
        { label: 'PM2.5, PM10 and SO2 offsets, 2-2-303', pols: ['PM2.5', 'PM10', 'SO2'], tpy: 100, ge: true, then: 'Offsets at 1:1 if the un-offset cumulative increase exceeds 1 tpy.' },
      ],
      sources: [
        'Regulation 2, Rule 2 New Source Review (amended December 6, 2017). 2-2-301: BACT for a new or modified source with potential to emit 10.0 lb or more of a pollutant on any day (2-1-217); for a modified source the increase must also exceed baseline (2-2-604).',
        '2-2-302: facility potential to emit above 10 tpy NOx or POC requires offsets at 1:1 (302.1, below 35 tpy) or 1.15:1 (302.2, 35 tpy or more). 2-2-303: facility at 100 tpy or more of PM2.5, PM10 or SO2 requires 1:1 offsets when the un-offset increase exceeds 1 tpy.',
        'Major modification thresholds (2-2-221): POC 40, NOx 40, SO2 40, PM10 15, PM2.5 10, CO 100 tpy. Federal PSD (2-2-224) applies at 100 or 250 tpy depending on source category.',
        'Totals here sum potential to emit. Offset obligations depend on the cumulative increase since the baseline date, banked credits and exemptions; treat a flag as a reason to check, not a final determination.',
      ],
    },

    // Annual chi/Q used by the Air District CEQA Health Risk Calculator 5.0 (posted May 3, 2022).
    ceqaChiQ: 360,

    rule25: {
      tbactCancer: 1.0, tbactHI: 0.2,
      projectCancer: 10, projectCancerOBC: 6, projectHI: 1.0,
      source: 'Regulation 2, Rule 5: 2-5-301 TBACT when source cancer risk exceeds 1.0 in a million or chronic HI exceeds 0.20; 2-5-302 project limits of 10 in a million (6 in a million in an Overburdened Community, other than Essential Public Service projects), chronic and acute HI of 1.0.',
    },

    // Cancer potency (CPF, (mg/kg-day)^-1, multipathway-weighted where applicable) and chronic REL (ug/m3) as carried in the
    // Air District CEQA Health Risk Calculator 5.0 (Regulation 2-5 Table 2-5-1, December 2021 amendments).
    // Trigger levels (lb/yr chronic, lb/hr acute) and acute RELs from Table 2-5-1.
    tac: [
      { key: 'dpm', name: 'Diesel exhaust particulate matter', cpf: 1.1, crel: 5, arel: null, chronicTrig: 0.26, acuteTrig: null },
      { key: 'benzene', name: 'Benzene', cpf: 0.1, crel: 3, arel: 27, chronicTrig: 2.9, acuteTrig: 0.012 },
      { key: 'formaldehyde', name: 'Formaldehyde', cpf: 0.021, crel: 9, arel: 55, chronicTrig: 14, acuteTrig: 0.024 },
      { key: 'acetaldehyde', name: 'Acetaldehyde', cpf: 0.01, crel: 140, arel: 470, chronicTrig: 29, acuteTrig: 0.21 },
      { key: 'butadiene', name: '1,3-Butadiene', cpf: 0.6, crel: 2, arel: 660, chronicTrig: 0.48, acuteTrig: 0.29 },
      { key: 'naphthalene', name: 'Naphthalene', cpf: 0.12, crel: 9, arel: null, chronicTrig: 2.4, acuteTrig: null },
      { key: 'ethylbenzene', name: 'Ethylbenzene', cpf: 0.0087, crel: 2000, arel: null, chronicTrig: 33, acuteTrig: null },
      { key: 'toluene', name: 'Toluene', cpf: 0, crel: 420, arel: 5000, chronicTrig: 16000, acuteTrig: 2.2 },
      { key: 'xylenes', name: 'Xylenes (mixed)', cpf: 0, crel: 700, arel: 22000, chronicTrig: 27000, acuteTrig: 9.7 },
      { key: 'hexane', name: 'n-Hexane', cpf: 0, crel: 7000, arel: null, chronicTrig: 270000, acuteTrig: null },
      { key: 'acrolein', name: 'Acrolein', cpf: 0, crel: 0.35, arel: 2.5, chronicTrig: 14, acuteTrig: 0.0011 },
      { key: 'h2s', name: 'Hydrogen sulfide', cpf: 0, crel: 10, arel: 42, chronicTrig: 390, acuteTrig: 0.019 },
      { key: 'perc', name: 'Perchloroethylene', cpf: 0.021, crel: 35, arel: 20000, chronicTrig: 14, acuteTrig: 8.8 },
      { key: 'mecl2', name: 'Methylene chloride', cpf: 0.0035, crel: 400, arel: 14000, chronicTrig: 82, acuteTrig: 6.2 },
      { key: 'cr6', name: 'Hexavalent chromium', cpf: 560, crel: 0.2, arel: null, chronicTrig: 0.00051, acuteTrig: null },
      { key: 'nickel', name: 'Nickel and compounds', cpf: 0.91, crel: 0.014, arel: 0.2, chronicTrig: 0.31, acuteTrig: 8.8e-05 },
      { key: 'arsenic', name: 'Arsenic and compounds', cpf: 180, crel: 0.00014, arel: 0.2, chronicTrig: 0.0016, acuteTrig: 8.8e-05 },
      { key: 'lead', name: 'Lead (inorganic)', cpf: 0.98, crel: null, arel: null, chronicTrig: 0.29, acuteTrig: null },
      { key: 'pah', name: 'PAHs (as benzo[a]pyrene equivalent)', cpf: 86, crel: null, arel: null, chronicTrig: 0.0033, acuteTrig: null },
      { key: 'ammonia', name: 'Ammonia', cpf: 0, crel: 200, arel: 3200, chronicTrig: 7700, acuteTrig: 1.4 },
    ],
    tacSource: 'Regulation 2-5 Table 2-5-1 (amended December 15, 2021, pages 2-5-11 to 2-5-26): acute trigger (lb/hr), chronic trigger (lb/yr), CREL weighting (ug/m3), CP weighting ((mg/kg-day)^-1) and acute inhalation REL (ug/m3). The weighting columns include multipathway exposure for arsenic, hexavalent chromium, lead, nickel and PAHs and are the same values the Air District CEQA Health Risk Calculator 5.0 uses. The 2010 standalone table_2-5-1.pdf is superseded.',

    // CARB, Revised Emission Factors for Gasoline Marketing Operations at California GDFs (Dec 23, 2013), Table I-I, EVR column, lb TOG per 1,000 gal.
    gdf: {
      components: [
        { name: 'Phase I bulk transfer (tank truck delivery)', lbPerKgal: 0.15 },
        { name: 'Pressure-driven losses (breathing)', lbPerKgal: 0.024 },
        { name: 'Phase II vehicle refueling', lbPerKgal: null, orvr: { non: 0.42, orvr: 0.021 } },
        { name: 'Spillage', lbPerKgal: 0.24 },
        { name: 'Hose permeation', lbPerKgal: 0.009 },
      ],
      source: 'CARB (2013) Revised Emission Factors for Gasoline Marketing Operations at California Gasoline Dispensing Facilities, Table I-I, EVR (enhanced vapor recovery) values in lb TOG per 1,000 gallons; refueling is weighted by the share of gallons dispensed to ORVR-equipped vehicles; hose permeation uses the 2017 value. The Air District applies its own internal spreadsheet built from CARB factors (Permit Handbook Ch. 3.2) and directs gas-station risk screening to the CARB Gas Station Risk Assessment Screening Tool.',
    },

    fees: {
      publicNotice: 2272, obcHra: 1000,
      source: 'Regulation 3 Fees, FY 2026-27 (effective July 1, 2026): 3-302 filing fee $684; Schedule B initial $107.28 per MMBtu/hr (min $573, max $200,137), risk assessment fee $684 + $107.28 per MMBtu/hr for the first TAC source (min $1,379) or $107.28 per MMBtu/hr for each additional (min $573), permit to operate $53.64 per MMBtu/hr (min $407, max $100,069), toxic surcharge 10% of the PTO fee; Schedule D $378.10 initial and $144.82 PTO per nozzle-product. Cross-checked against the Air District "Example Engine Permit Fees" sheet updated September 28, 2026. Public notice: minimum $2,272 invoice, plus $1,000 for an HRA in an Overburdened Community.',
    },
  };
  root.APT_DATA = DATA;
})(typeof window !== 'undefined' ? window : globalThis);

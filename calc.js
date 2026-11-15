/*
 * Air Permit Engineering Toolkit: calculation engine.
 * Pure functions, no DOM. Loaded by index.html in the browser and by tests/verify.mjs in Node.
 * Every function returns { out: {...}, steps: [...] } so the page can show the full arithmetic trail.
 * Independent open-source project. Not affiliated with or endorsed by the Bay Area Air District.
 */
(function (root) {
  'use strict';

  // ---------- Physical constants ----------
  const K = {
    G_PER_LB: 453.592,
    LB_PER_TON: 2000,
    KG_PER_LB: 0.45359237,
    MOLAR_VOL_68F: 385.3,   // scf/lb-mol at 68 F, 29.92 inHg (EPA Method 19 standard conditions)
    MOLAR_VOL_60F: 379.5,   // scf/lb-mol at 60 F, 14.696 psia (oil and gas reporting basis)
    KW_PER_HP: 0.7457,
    O2_AMBIENT: 20.9,
    MW: { NOx: 46.01, CO: 28.01, SO2: 64.06, H2S: 34.08, CH4: 16.04, NH3: 17.03, VOC_as_CH4: 16.04 },
  };

  // ---------- Reference data (each with a source string shown in the UI) ----------
  const DATA = {
    // AP-42 Chapter 1.4 (07/98), Tables 1.4-1 and 1.4-2, natural gas combustion, lb per 10^6 scf at 1,020 Btu/scf.
    ap42NG: {
      source: 'US EPA AP-42, 5th ed., Section 1.4 Natural Gas Combustion (07/98), Tables 1.4-1 and 1.4-2; factors in lb/10^6 scf divided by 1,020 Btu/scf.',
      hhv: 1020,
      NOx: { uncontrolled: 100, lowNOx: 50, lowNOxFGR: 32 },
      CO: 84, POC: 5.5, PM: 7.6, SO2: 0.6, CO2: 120000,
    },
    // AP-42 Section 13.5 Industrial Flares (02/2018), Table 13.5-1.
    ap42Flare: {
      source: 'US EPA AP-42 Section 13.5 Industrial Flares (02/2018), Table 13.5-1 (elevated flares, lb/MMBtu).',
      NOx: 0.068, CO: 0.31,
    },
    // EPA Method 19 (40 CFR 60 App. A-7) Table 19-2 dry F-factors, dscf/MMBtu at 68 F.
    fd: {
      source: '40 CFR Part 60 Appendix A-7, Method 19, Table 19-2 (Fd, dscf/MMBtu, 68 F).',
      'Natural gas': 8710, 'Propane': 8710, 'Butane': 8710, 'Fuel oil (distillate or residual)': 9190,
      'Coal, bituminous': 9780, 'Wood': 9240,
    },
    // 40 CFR 98 Subpart C Tables C-1 and C-2 (kg/MMBtu).
    ghg: {
      source: '40 CFR Part 98 Subpart C, Table C-1 (CO2) and Table C-2 (CH4, N2O), kg/MMBtu.',
      fuels: {
        'Natural gas': { CO2: 53.06, CH4: 1.0e-3, N2O: 1.0e-4 },
        'Distillate fuel oil No. 2': { CO2: 73.96, CH4: 3.0e-3, N2O: 6.0e-4 },
        'Propane': { CO2: 62.87, CH4: 3.0e-3, N2O: 6.0e-4 },
      },
      // BAAQMD Regulation 3 Schedule T global warming potentials (IPCC AR5 with climate-carbon feedbacks).
      gwp: { CO2: 1, CH4: 34, N2O: 298 },
      feePerMT: 0.174,
      feeSource: 'BAAQMD Regulation 3, Schedule T Greenhouse Gas Fees: $0.174 per metric ton CO2e; GWP CH4 34, N2O 298.',
    },
  };

  // ---------- Helpers ----------
  // Default: about 4 significant figures with thousands separators. With d given: at most d decimals.
  const fmt = (x, d) => {
    if (typeof x === 'string' && x.trim() !== '' && isFinite(Number(x))) x = Number(x);
    if (x === null || x === undefined || typeof x !== 'number' || !isFinite(x)) return String(x);
    const a = Math.abs(x);
    if (a === 0) return '0';
    if (d === undefined && (a < 1e-3 || a >= 1e10)) return x.toExponential(2);
    const dec = d !== undefined ? d : Math.min(Math.max(3 - Math.floor(Math.log10(a)), 0), 6);
    return x.toLocaleString('en-US', { maximumFractionDigits: dec });
  };
  const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
  function step(steps, label, expr, value, unit) { steps.push({ label, expr, value, unit: unit || '' }); return value; }
  function num(v, name) {
    const x = Number(v);
    if (!isFinite(x)) throw new Error(name + ' must be a number.');
    return x;
  }
  function nonneg(v, name) { const x = num(v, name); if (x < 0) throw new Error(name + ' cannot be negative.'); return x; }

  // ---------- 1. Units: concentration conversions ----------
  // ppmvd at measured O2 -> ppmvd at reference O2
  function o2Correct(ppm, o2meas, o2ref) {
    if (o2meas >= K.O2_AMBIENT) throw new Error('Measured O2 must be below 20.9%.');
    return ppm * (K.O2_AMBIENT - o2ref) / (K.O2_AMBIENT - o2meas);
  }
  // ppmvd at reference O2 -> lb/MMBtu, EPA Method 19 O2-based F-factor equation (19-1).
  function ppmToLbMMBtu(ppm, mw, fd, o2ref) {
    const lbPerDscf = ppm * 1e-6 * mw / K.MOLAR_VOL_68F;
    return lbPerDscf * fd * K.O2_AMBIENT / (K.O2_AMBIENT - o2ref);
  }
  function lbMMBtuToPpm(e, mw, fd, o2ref) { return e / ppmToLbMMBtu(1, mw, fd, o2ref); }
  // ppmv <-> mg/m3 at 25 C, 1 atm (24.45 L/mol)
  function ppmToMgM3(ppm, mw) { return ppm * mw / 24.45; }

  function concConvert(p) {
    const steps = [];
    const ppm = nonneg(p.ppm, 'Concentration');
    const o2m = num(p.o2meas, 'Measured O2');
    const o2r = num(p.o2ref, 'Reference O2');
    const mw = nonneg(p.mw, 'Molecular weight');
    const fd = nonneg(p.fd, 'F-factor');
    if (o2m >= K.O2_AMBIENT || o2r >= K.O2_AMBIENT) throw new Error('O2 values must be below 20.9%.');
    const ppmRef = step(steps, 'Correct to reference O2', `${fmt(ppm)} x (20.9 - ${o2r}) / (20.9 - ${o2m})`, o2Correct(ppm, o2m, o2r), `ppmvd @ ${o2r}% O2`);
    const lbDscf = step(steps, 'Mass per dry standard cubic foot', `${fmt(ppmRef)} x 1e-6 x ${mw} / 385.3`, ppmRef * 1e-6 * mw / K.MOLAR_VOL_68F, 'lb/dscf');
    const e = step(steps, 'Emission rate per heat input (Method 19)', `${fmt(lbDscf)} x ${fd} x 20.9 / (20.9 - ${o2r})`, lbDscf * fd * K.O2_AMBIENT / (K.O2_AMBIENT - o2r), 'lb/MMBtu');
    const mg = step(steps, 'Mass concentration at 25 C, 1 atm (dry, at measured O2)', `${fmt(ppm)} x ${mw} / 24.45`, ppmToMgM3(ppm, mw), 'mg/m3');
    let lbhr = null;
    if (p.heat && Number(p.heat) > 0) {
      lbhr = step(steps, 'Mass emission rate', `${fmt(e)} lb/MMBtu x ${fmt(Number(p.heat))} MMBtu/hr`, e * Number(p.heat), 'lb/hr');
    }
    return { out: { ppmRef, lbPerMMBtu: e, mgm3: mg, lbhr }, steps };
  }

  // ---------- 2. Control efficiency ----------
  function controlEff(p) {
    const steps = [];
    const cap = clamp(nonneg(p.capture, 'Capture efficiency'), 0, 100) / 100;
    const des = clamp(nonneg(p.destruction, 'Control efficiency'), 0, 100) / 100;
    const sec = p.secondary ? clamp(nonneg(p.secondary, 'Second device efficiency'), 0, 100) / 100 : 0;
    const overall = step(steps, 'Overall control (capture x control, then a second device in series)',
      `1 - [1 - ${cap} x ${des}] x (1 - ${sec})`, 1 - (1 - cap * des) * (1 - sec), 'fraction');
    const uncontrolled = nonneg(p.uncontrolled || 0, 'Uncontrolled emissions');
    const residual = step(steps, 'Controlled emissions', `${fmt(uncontrolled)} x (1 - ${fmt(overall)})`, uncontrolled * (1 - overall), p.unit || '');
    return { out: { overall, residual }, steps };
  }

  // ---------- 3. Combustion source (boiler, heater, turbine) ----------
  // p: { heatInput MMBtu/hr, hrsDay, hrsYr, fuel, factors: {NOx,CO,POC,PM10,SO2} in lb/MMBtu, controlPct }
  function combustion(p) {
    const steps = [];
    const H = nonneg(p.heatInput, 'Heat input');
    const hd = clamp(nonneg(p.hrsDay, 'Hours per day'), 0, 24);
    const hy = clamp(nonneg(p.hrsYr, 'Hours per year'), 0, 8760);
    if (hy > hd * 365 + 1e-9) throw new Error('Hours per year cannot exceed hours per day x 365.');
    step(steps, 'Maximum daily fuel heat input', `${fmt(H)} MMBtu/hr x ${hd} hr/day`, H * hd, 'MMBtu/day');
    step(steps, 'Annual fuel heat input', `${fmt(H)} MMBtu/hr x ${hy} hr/yr`, H * hy, 'MMBtu/yr');
    const rows = [];
    for (const [pol, ef] of Object.entries(p.factors)) {
      const f = nonneg(ef, pol + ' factor');
      const lbhr = H * f;
      const lbday = lbhr * hd;
      const lbyr = lbhr * hy;
      step(steps, `${pol} hourly`, `${fmt(H)} MMBtu/hr x ${fmt(f)} lb/MMBtu`, lbhr, 'lb/hr');
      step(steps, `${pol} maximum day`, `${fmt(lbhr)} lb/hr x ${hd} hr`, lbday, 'lb/day');
      step(steps, `${pol} annual`, `${fmt(lbhr)} lb/hr x ${hy} hr / 2,000`, lbyr / K.LB_PER_TON, 'ton/yr');
      rows.push({ pol, ef: f, lbhr, lbday, lbyr, tpy: lbyr / K.LB_PER_TON });
    }
    // GHG
    const g = DATA.ghg.fuels[p.fuel] || DATA.ghg.fuels['Natural gas'];
    const mmbtuYr = H * hy;
    const co2 = mmbtuYr * g.CO2 / 1000, ch4 = mmbtuYr * g.CH4 / 1000, n2o = mmbtuYr * g.N2O / 1000;
    const co2e = step(steps, 'Greenhouse gases (metric tons CO2e/yr)',
      `${fmt(mmbtuYr)} MMBtu x (${g.CO2} + ${g.CH4} x 34 + ${g.N2O} x 298) kg / 1,000`,
      co2 + ch4 * DATA.ghg.gwp.CH4 + n2o * DATA.ghg.gwp.N2O, 'MT CO2e/yr');
    return { out: { rows, co2, ch4, n2o, co2e, ghgFee: co2e * DATA.ghg.feePerMT }, steps };
  }

  // AP-42 natural-gas factors converted to lb/MMBtu.
  function ap42NGFactors(nox) {
    const d = DATA.ap42NG;
    return {
      NOx: d.NOx[nox || 'uncontrolled'] / d.hhv, CO: d.CO / d.hhv, POC: d.POC / d.hhv,
      PM10: d.PM / d.hhv, SO2: d.SO2 / d.hhv,
    };
  }

  // ---------- 4. Reciprocating engine (generator, pump) ----------
  // p: { power, powerUnit: 'bhp'|'kWm'|'kWe', genEff (for kWe), hrsDay, hrsYr, factors g/bhp-hr }
  function engine(p) {
    const steps = [];
    let bhp = nonneg(p.power, 'Engine rating');
    if (p.powerUnit === 'kWm') {
      bhp = step(steps, 'Convert mechanical kW to bhp', `${fmt(p.power)} kW / 0.7457`, bhp / K.KW_PER_HP, 'bhp');
    } else if (p.powerUnit === 'kWe') {
      const eff = clamp(nonneg(p.genEff, 'Generator efficiency'), 1, 100) / 100;
      bhp = step(steps, 'Convert electrical kW to engine bhp', `${fmt(p.power)} kWe / ${eff} / 0.7457`, bhp / eff / K.KW_PER_HP, 'bhp');
    }
    const hd = clamp(nonneg(p.hrsDay, 'Hours per day'), 0, 24);
    const hy = clamp(nonneg(p.hrsYr, 'Hours per year'), 0, 8760);
    const rows = [];
    for (const [pol, ef] of Object.entries(p.factors)) {
      const f = nonneg(ef, pol + ' factor');
      const lbhr = bhp * f / K.G_PER_LB;
      step(steps, `${pol} hourly`, `${fmt(bhp)} bhp x ${fmt(f)} g/bhp-hr / 453.592`, lbhr, 'lb/hr');
      step(steps, `${pol} maximum day`, `${fmt(lbhr)} x ${hd} hr`, lbhr * hd, 'lb/day');
      step(steps, `${pol} annual`, `${fmt(lbhr)} x ${hy} hr`, lbhr * hy, 'lb/yr');
      rows.push({ pol, ef: f, lbhr, lbday: lbhr * hd, lbyr: lbhr * hy, tpy: lbhr * hy / K.LB_PER_TON });
    }
    // Diesel fuel use, for GHG: brake-specific fuel consumption 7,000 Btu/bhp-hr (AP-42 Table 3.3-1 footnote).
    const bsfc = Number(p.bsfc) > 0 ? Number(p.bsfc) : 7000;
    const mmbtuYr = step(steps, 'Annual fuel heat input', `${fmt(bhp)} bhp x ${bsfc} Btu/bhp-hr x ${hy} hr / 1e6`, bhp * bsfc * hy / 1e6, 'MMBtu/yr');
    const g = DATA.ghg.fuels['Distillate fuel oil No. 2'];
    const co2e = step(steps, 'Greenhouse gases', `${fmt(mmbtuYr)} x (${g.CO2} + ${g.CH4} x 34 + ${g.N2O} x 298) / 1,000`,
      mmbtuYr * (g.CO2 + g.CH4 * 34 + g.N2O * 298) / 1000, 'MT CO2e/yr');
    return { out: { bhp, rows, mmbtuYr, co2e }, steps };
  }

  // ---------- 5. Flare ----------
  // p: { volume (scf per period), periodHrs, hhv Btu/scf, h2sPpm, vocFrac (lb VOC per lb-mol? use mass), dre %, noxEf, coEf, vocMW }
  function flare(p) {
    const steps = [];
    const V = nonneg(p.volumeMscf, 'Gas volume') * 1000;
    const hrs = nonneg(p.hours, 'Event duration');
    const hhv = nonneg(p.hhv, 'Heating value');
    const heat = step(steps, 'Heat released', `${fmt(V)} scf x ${fmt(hhv)} Btu/scf / 1e6`, V * hhv / 1e6, 'MMBtu');
    const nox = step(steps, 'NOx', `${fmt(heat)} MMBtu x ${p.noxEf} lb/MMBtu`, heat * nonneg(p.noxEf, 'NOx factor'), 'lb');
    const co = step(steps, 'CO', `${fmt(heat)} MMBtu x ${p.coEf} lb/MMBtu`, heat * nonneg(p.coEf, 'CO factor'), 'lb');
    const mol = step(steps, 'Moles of gas flared', `${fmt(V)} scf / ${K.MOLAR_VOL_60F} scf/lb-mol (60 F)`, V / K.MOLAR_VOL_60F, 'lb-mol');
    const h2s = nonneg(p.h2sPpm || 0, 'H2S');
    const so2 = step(steps, 'SO2 (all H2S oxidized)', `${fmt(mol)} lb-mol x ${fmt(h2s)}e-6 x 64.06`, mol * h2s * 1e-6 * K.MW.SO2, 'lb');
    const vocMol = clamp(nonneg(p.vocMolPct || 0, 'VOC mole percent'), 0, 100) / 100;
    const vocMW = nonneg(p.vocMW || 44.1, 'VOC molecular weight');
    const dre = clamp(nonneg(p.dre, 'Destruction efficiency'), 0, 100) / 100;
    const vocIn = step(steps, 'VOC sent to flare', `${fmt(mol)} lb-mol x ${vocMol} x ${vocMW} lb/lb-mol`, mol * vocMol * vocMW, 'lb');
    const voc = step(steps, 'VOC emitted (uncombusted)', `${fmt(vocIn)} x (1 - ${dre})`, vocIn * (1 - dre), 'lb');
    const per = (x) => (hrs > 0 ? x / hrs : null);
    return { out: { heat, nox, co, so2, voc, vocIn, mol, noxHr: per(nox), coHr: per(co), so2Hr: per(so2), vocHr: per(voc) }, steps };
  }

  // ---------- 6. Coating and solvent VOC ----------
  function coating(p) {
    const steps = [];
    const gal = nonneg(p.gallons, 'Coating used');
    const voc = nonneg(p.vocLbGal, 'VOC content');
    const cap = clamp(nonneg(p.capture || 0, 'Capture'), 0, 100) / 100;
    const des = clamp(nonneg(p.destruction || 0, 'Control'), 0, 100) / 100;
    const days = nonneg(p.daysYr, 'Operating days');
    const unc = step(steps, 'Uncontrolled VOC', `${fmt(gal)} gal x ${fmt(voc)} lb/gal`, gal * voc, 'lb/yr');
    const ov = step(steps, 'Overall control', `${cap} x ${des}`, cap * des, 'fraction');
    const ctl = step(steps, 'Controlled VOC', `${fmt(unc)} x (1 - ${fmt(ov)})`, unc * (1 - ov), 'lb/yr');
    const day = step(steps, 'Average day', `${fmt(ctl)} / ${days} days`, days > 0 ? ctl / days : 0, 'lb/day');
    const maxGalDay = nonneg(p.maxGalDay || 0, 'Maximum daily use');
    const maxDay = step(steps, 'Maximum day (from maximum daily use)', `${fmt(maxGalDay)} gal x ${fmt(voc)} x (1 - ${fmt(ov)})`, maxGalDay * voc * (1 - ov), 'lb/day');
    return { out: { unc, ctl, tpy: ctl / K.LB_PER_TON, day, maxDay, overall: ov }, steps };
  }

  // Convert VOC content: g/L less water and exempt compounds -> lb/gal
  function gPerLtoLbPerGal(gl) { return gl * 3.785411784 / K.G_PER_LB; }

  // ---------- 7. Screening dispersion (Gaussian plume, ground-level centerline) ----------
  const BRIGGS = {
    urban: {
      y: { A: [0.32, 0.0004, -0.5], B: [0.32, 0.0004, -0.5], C: [0.22, 0.0004, -0.5], D: [0.16, 0.0004, -0.5], E: [0.11, 0.0004, -0.5], F: [0.11, 0.0004, -0.5] },
      z: { A: [0.24, 0.001, 0.5], B: [0.24, 0.001, 0.5], C: [0.20, 0, 0], D: [0.14, 0.0003, -0.5], E: [0.08, 0.0015, -0.5], F: [0.08, 0.0015, -0.5] },
    },
    rural: {
      y: { A: [0.22, 0.0001, -0.5], B: [0.16, 0.0001, -0.5], C: [0.11, 0.0001, -0.5], D: [0.08, 0.0001, -0.5], E: [0.06, 0.0001, -0.5], F: [0.04, 0.0001, -0.5] },
      z: { A: [0.20, 0, 0], B: [0.12, 0, 0], C: [0.08, 0.0002, -0.5], D: [0.06, 0.0015, -0.5], E: [0.03, 0.0003, -1], F: [0.016, 0.0003, -1] },
    },
  };
  function sigma(c, x) { return c[0] * x * Math.pow(1 + c[1] * x, c[2]); }

  // Briggs plume rise (buoyancy dominated), final rise, used only when the user opts in.
  function plumeRiseBriggs(vs, d, Ts, Ta, u) {
    if (Ts <= Ta) return 0;
    const F = 9.807 * vs * d * d * (Ts - Ta) / (4 * Ts);
    return F < 55 ? 21.425 * Math.pow(F, 0.75) / u : 38.71 * Math.pow(F, 0.6) / u;
  }

  // Concentration per unit emission (ug/m3 per g/s) at downwind distance x (m).
  function chiOverQ(x, H, u, cls, terrain) {
    const set = BRIGGS[terrain] || BRIGGS.urban;
    const sy = sigma(set.y[cls], x), sz = sigma(set.z[cls], x);
    return 1e6 / (Math.PI * u * sy * sz) * Math.exp(-(H * H) / (2 * sz * sz));
  }

  function dispersion(p) {
    const steps = [];
    const hs = nonneg(p.stackHt, 'Stack height');
    const u = Math.max(nonneg(p.wind, 'Wind speed'), 0.5);
    const cls = p.stability || 'D';
    const terrain = p.terrain || 'urban';
    let dh = 0;
    if (p.plumeRise) {
      dh = plumeRiseBriggs(nonneg(p.vs, 'Exit velocity'), nonneg(p.diam, 'Stack diameter'), nonneg(p.Ts, 'Exit temperature'), nonneg(p.Ta || 293, 'Ambient temperature'), u);
      step(steps, 'Briggs final plume rise (buoyancy)', 'F = g vs d^2 (Ts - Ta) / (4 Ts); dh = 21.425 F^0.75 / u (F < 55) or 38.71 F^0.6 / u', dh, 'm');
    }
    const H = step(steps, 'Effective release height', `${hs} m + ${fmt(dh)} m`, hs + dh, 'm');
    const Qgs = nonneg(p.lbhr, 'Emission rate') * K.G_PER_LB / 3600;
    step(steps, 'Emission rate', `${fmt(Number(p.lbhr))} lb/hr x 453.592 / 3,600`, Qgs, 'g/s');
    const curve = [];
    let best = { x: 0, c: 0 };
    for (let i = 0; i <= 240; i++) {
      const x = 10 * Math.pow(10, i / 80); // 10 m to 10 km, log spaced
      const c = chiOverQ(x, H, u, cls, terrain);
      curve.push({ x, c });
      if (c > best.c) best = { x, c };
    }
    const xr = nonneg(p.receptor || 0, 'Receptor distance');
    const chiRec = xr > 0 ? chiOverQ(xr, H, u, cls, terrain) : null;
    step(steps, 'Maximum 1-hour chi/Q (scan 10 m to 10 km)', `C/Q = 1e6 / (pi u sy sz) x exp(-H^2 / 2 sz^2), max at x = ${fmt(best.x, 0)} m`, best.c, 'ug/m3 per g/s');
    const c1 = step(steps, 'Maximum 1-hour concentration', `${fmt(best.c)} x ${fmt(Qgs)} g/s`, best.c * Qgs, 'ug/m3');
    const ann = step(steps, 'Annual average (AERSCREEN scaling factor 0.1)', `${fmt(c1)} x 0.1`, c1 * 0.1, 'ug/m3');
    let rec = null;
    if (chiRec !== null) rec = step(steps, `1-hour concentration at ${fmt(xr, 0)} m`, `${fmt(chiRec)} x ${fmt(Qgs)}`, chiRec * Qgs, 'ug/m3');
    return { out: { H, Qgs, maxChiQ: best.c, xMax: best.x, c1hr: c1, annual: ann, recChiQ: chiRec, c1hrRec: rec, curve }, steps };
  }

  // ---------- 8. Cancer risk and hazard index (OEHHA 2015 method) ----------
  // Residential: BAAQMD Air Toxics NSR HRA Guidelines (2016) use 95th percentile breathing rates for
  // the third trimester and ages 0-2, 80th percentile for ages 2-16 and 16-30; ASF 10, 10, 3, 1;
  // FAH 1.0 below age 16 and 0.73 for 16-30; EF 350/365; AT 70 years; 30-year exposure.
  const RESIDENT_BINS = [
    { bin: 'Third trimester', DBR: 361, ASF: 10, ED: 0.25, FAH: 1.0 },
    { bin: 'Age 0 to 2', DBR: 1090, ASF: 10, ED: 2, FAH: 1.0 },
    { bin: 'Age 2 to 16', DBR: 572, ASF: 3, ED: 14, FAH: 1.0 },
    { bin: 'Age 16 to 30', DBR: 233, ASF: 1, ED: 14, FAH: 0.73 },
  ];
  // Unit residential risk: chances per million per (ug/m3 x CPF).
  function residentFactor() {
    let s = 0;
    for (const b of RESIDENT_BINS) s += b.DBR * b.ASF * b.ED * b.FAH;
    return s * (350 / 365) * 1e-6 / 70; // multiply by C (ug/m3) and CPF (mg/kg-day)^-1 -> risk
  }
  // Worker: 8-hour breathing rate 230 L/kg-8hr, 250 days/yr, 25 years, ASF 1, WAF 1 (source operates when worker present).
  function workerFactor(waf) { return 230 * (waf || 1) * (250 / 365) * 1e-6 * 25 / 70; }

  function riskFromConc(p) {
    const steps = [];
    const C = nonneg(p.annualConc, 'Annual concentration');
    const cpf = nonneg(p.cpf || 0, 'Cancer potency factor');
    const rf = residentFactor();
    const sumTerms = RESIDENT_BINS.map(b => `${b.DBR} x ${b.ASF} x ${b.ED} x ${b.FAH}`).join(' + ');
    step(steps, 'Residential exposure factor', `(${sumTerms}) x (350/365) x 1e-6 / 70`, rf, 'per (ug/m3 x CPF)');
    const resRisk = step(steps, 'Residential cancer risk', `${fmt(C)} ug/m3 x ${cpf} x ${fmt(rf)} x 1e6`, C * cpf * rf * 1e6, 'in a million');
    const wf = workerFactor(p.waf);
    const wRisk = step(steps, 'Worker cancer risk', `${fmt(C)} x ${cpf} x 230 x ${p.waf || 1} x (250/365) x 1e-6 x 25/70 x 1e6`, C * cpf * wf * 1e6, 'in a million');
    let hic = null, hia = null;
    if (Number(p.chronicREL) > 0) hic = step(steps, 'Chronic hazard index', `${fmt(C)} / ${p.chronicREL}`, C / Number(p.chronicREL), '');
    if (Number(p.acuteREL) > 0 && Number(p.maxHrConc) >= 0) hia = step(steps, 'Acute hazard index', `${fmt(Number(p.maxHrConc))} / ${p.acuteREL}`, Number(p.maxHrConc) / Number(p.acuteREL), '');
    return { out: { resRisk, wRisk, hic, hia }, steps };
  }

  // ---------- 9. Regulation 3 fees ----------
  // Values set from BAAQMD Regulation 3 (see FEES.source). Rounded to cents.
  const FEES = {
    source: 'BAAQMD Regulation 3 Fees (current amendment). Section 3-302 filing fee; Schedule B Combustion of Fuel; Schedule D Gasoline Dispensing.',
    filing: 684,
    B: { initRate: 107.28, initMin: 573, initMax: 200137, rafBase: 684, rafRate: 107.28, rafMin1: 1379, rafMinAdd: 573, rafMax: 200137, ptoRate: 53.64, ptoMin: 407, ptoMax: 100069 },
    D: { init: 378.10, pto: 144.82, modRate: 522.91 },
  };
  const r2 = (x) => Math.round(x * 100) / 100;

  function feesScheduleB(p) {
    const steps = [];
    const M = nonneg(p.mmbtu, 'Maximum firing rate');
    const B = FEES.B;
    const filing = step(steps, 'Filing fee (3-302)', 'flat', FEES.filing, '$');
    const init = step(steps, 'Initial fee', `clamp(${B.initRate} x ${fmt(M)}, ${B.initMin}, ${B.initMax})`, r2(clamp(B.initRate * M, B.initMin, B.initMax)), '$');
    let raf = 0;
    if (p.raf === 'first') raf = step(steps, 'Risk assessment fee, first TAC source', `min(max(${B.rafBase} + ${B.rafRate} x ${fmt(M)}, ${B.rafMin1}), ${B.rafMax})`, r2(Math.min(Math.max(B.rafBase + B.rafRate * M, B.rafMin1), B.rafMax)), '$');
    if (p.raf === 'additional') raf = step(steps, 'Risk assessment fee, additional TAC source', `min(max(${B.rafRate} x ${fmt(M)}, ${B.rafMinAdd}), ${B.rafMax})`, r2(Math.min(Math.max(B.rafRate * M, B.rafMinAdd), B.rafMax)), '$');
    let pto = step(steps, 'Permit to operate fee', `clamp(${B.ptoRate} x ${fmt(M)}, ${B.ptoMin}, ${B.ptoMax})`, r2(clamp(B.ptoRate * M, B.ptoMin, B.ptoMax)), '$');
    let sur = 0;
    if (p.toxicSurcharge) sur = step(steps, 'Toxic surcharge (10% of PTO fee)', `${fmt(pto)} x 0.10`, r2(pto * 0.1), '$');
    let solid = 0;
    if (p.solidFuel) solid = step(steps, 'Solid-fuel surcharge (100% of initial + PTO)', `${fmt(init)} + ${fmt(pto)}`, r2(init + pto), '$');
    const total = step(steps, 'Total due with application', 'filing + initial + RAF + PTO + surcharges', r2(filing + init + raf + pto + sur + solid), '$');
    return { out: { filing, init, raf, pto, sur, solid, total }, steps };
  }

  function feesScheduleD(p) {
    const steps = [];
    const n = nonneg(p.nozzleProducts, 'Nozzle-products');
    const filing = step(steps, 'Filing fee (3-302)', 'flat', FEES.filing, '$');
    const init = step(steps, 'Initial fee', `${FEES.D.init} x ${n} nozzle-products`, r2(FEES.D.init * n), '$');
    const pto = step(steps, 'Permit to operate fee', `${FEES.D.pto} x ${n}`, r2(FEES.D.pto * n), '$');
    const total = step(steps, 'Total', 'filing + initial + PTO', r2(filing + init + pto), '$');
    return { out: { filing, init, pto, total }, steps };
  }

  const api = {
    K, DATA, FEES, BRIGGS, RESIDENT_BINS, fmt,
    o2Correct, ppmToLbMMBtu, lbMMBtuToPpm, ppmToMgM3, gPerLtoLbPerGal,
    concConvert, controlEff, combustion, ap42NGFactors, engine, flare, coating,
    chiOverQ, plumeRiseBriggs, dispersion, residentFactor, workerFactor, riskFromConc,
    feesScheduleB, feesScheduleD,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.APT = api;
})(typeof window !== 'undefined' ? window : globalThis);

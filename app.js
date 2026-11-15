/* Air Permit Engineering Toolkit: user interface. Depends on calc.js (window.APT) and data.js (window.APT_DATA). */
(function () {
  'use strict';
  const A = window.APT;
  const D = window.APT_DATA;
  const fmt = A.fmt;
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Project store (sources added from emission calculators) ----------
  const store = {
    key: 'apt-project-v1',
    load() { try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch (e) { return []; } },
    save(list) { try { localStorage.setItem(this.key, JSON.stringify(list)); } catch (e) { /* storage blocked: keep in memory */ } this.mem = list; },
    get() { return this.mem || (this.mem = this.load()); },
  };

  const POLS = ['NOx', 'CO', 'POC', 'PM10', 'PM2.5', 'SO2'];

  // ---------- Module definitions ----------
  const NG = A.ap42NGFactors('uncontrolled');
  const MODULES = [
    {
      id: 'combustion', group: 'Estimate emissions', title: 'Boiler, heater or turbine',
      intro: 'Emissions from fuel combustion at the maximum firing rate. Hourly and daily values use the permitted maximum; annual values use the requested hours. Defaults are AP-42 natural-gas factors for an uncontrolled small boiler; replace them with the vendor guarantee or the BACT limit you are proposing.',
      fields: [
        { id: 'name', label: 'Source name', type: 'text', value: 'S-1 Boiler' },
        { id: 'heat', label: 'Maximum firing rate', unit: 'MMBtu/hr (HHV)', value: 5 },
        { id: 'fuel', label: 'Fuel', type: 'select', options: Object.keys(A.DATA.ghg.fuels), value: 'Natural gas' },
        { id: 'hd', label: 'Hours per day', unit: 'hr/day', value: 24 },
        { id: 'hy', label: 'Hours per year', unit: 'hr/yr', value: 2000 },
        { legend: 'Emission factors (lb/MMBtu)' },
        { id: 'NOx', label: 'NOx', unit: 'lb/MMBtu', value: +NG.NOx.toFixed(4), help: 'Tip: 9 ppmvd @ 3% O2 on natural gas is about 0.011 lb/MMBtu. Use Unit conversions.' },
        { id: 'CO', label: 'CO', unit: 'lb/MMBtu', value: +NG.CO.toFixed(4) },
        { id: 'POC', label: 'POC (precursor organic compounds)', unit: 'lb/MMBtu', value: +NG.POC.toFixed(5) },
        { id: 'PM10', label: 'PM10 (= PM2.5 for gas firing)', unit: 'lb/MMBtu', value: +NG.PM10.toFixed(5) },
        { id: 'SO2', label: 'SO2', unit: 'lb/MMBtu', value: +NG.SO2.toFixed(5) },
      ],
      run(v) {
        const f = { NOx: v.NOx, CO: v.CO, POC: v.POC, PM10: v.PM10, 'PM2.5': v.PM10, SO2: v.SO2 };
        const r = A.combustion({ heatInput: v.heat, hrsDay: v.hd, hrsYr: v.hy, fuel: v.fuel, factors: f });
        return emissionsResult(v.name, r, { mmbtu: +v.heat, kind: 'combustion', co2e: r.out.co2e }, [A.DATA.ap42NG.source, A.DATA.ghg.source, A.DATA.ghg.feeSource]);
      },
    },
    {
      id: 'engine', group: 'Estimate emissions', title: 'Diesel engine or generator',
      intro: 'Emissions from a reciprocating engine using certified g/bhp-hr factors (EPA or CARB engine family certificate). Standby generators are limited to maintenance and testing hours by the state Stationary Diesel Engine ATCM; check the limit that applies. Default factors are the EPA Tier 4 Final limits for generator sets above 900 kW; replace them with the certified values for the engine family.',
      fields: [
        { id: 'name', label: 'Source name', type: 'text', value: 'S-2 Standby generator' },
        { id: 'power', label: 'Rating', value: 1000 },
        { id: 'pu', label: 'Rating unit', type: 'select', options: [['bhp', 'Brake horsepower (bhp)'], ['kWm', 'Mechanical kW'], ['kWe', 'Electrical kW (generator output)']], value: 'kWe' },
        { id: 'geff', label: 'Generator efficiency (for kWe only)', unit: '%', value: 95 },
        { id: 'hd', label: 'Hours per day (worst case)', unit: 'hr/day', value: 24 },
        { id: 'hy', label: 'Hours per year (maintenance and testing)', unit: 'hr/yr', value: 50 },
        { legend: 'Certified emission factors (g/bhp-hr)' },
        { id: 'NOx', label: 'NOx', unit: 'g/bhp-hr', value: 0.5 },
        { id: 'CO', label: 'CO', unit: 'g/bhp-hr', value: 2.6 },
        { id: 'POC', label: 'POC (NMHC)', unit: 'g/bhp-hr', value: 0.14 },
        { id: 'PM10', label: 'PM10 = diesel particulate matter', unit: 'g/bhp-hr', value: 0.022 },
        { id: 'SO2', label: 'SO2 (15 ppm sulfur fuel)', unit: 'g/bhp-hr', value: 0.0055, help: 'Ultra-low-sulfur diesel: about 0.005 to 0.006 g/bhp-hr.' },
      ],
      run(v) {
        const f = { NOx: v.NOx, CO: v.CO, POC: v.POC, PM10: v.PM10, 'PM2.5': v.PM10, SO2: v.SO2 };
        const r = A.engine({ power: v.power, powerUnit: v.pu, genEff: v.geff, hrsDay: v.hd, hrsYr: v.hy, factors: f });
        const mmbtu = r.out.bhp * 7000 / 1e6;
        const dpm = r.out.rows.find((x) => x.pol === 'PM10');
        const extra = [];
        const trig = D.tac.find((t) => t.key === 'dpm');
        if (dpm && trig && trig.chronicTrig) {
          extra.push(dpm.lbyr > trig.chronicTrig
            ? { level: 'warn', text: `<b>Diesel PM ${fmt(dpm.lbyr)} lb/yr exceeds the Table 2-5-1 chronic trigger of ${trig.chronicTrig} lb/yr.</b> A health risk assessment under Rule 2-5 is required. Carry this source into Toxics screening.` }
            : { level: 'ok', text: `Diesel PM ${fmt(dpm.lbyr)} lb/yr is below the Table 2-5-1 chronic trigger of ${trig.chronicTrig} lb/yr.` });
        }
        extra.push({ level: 'info', text: `Engine rating used: <b>${fmt(r.out.bhp, 1)} bhp</b>. Fee basis at 7,000 Btu/bhp-hr: <b>${fmt(mmbtu, 3)} MMBtu/hr</b>.` });
        return emissionsResult(v.name, r, { mmbtu, kind: 'engine', co2e: r.out.co2e, tac: dpm ? { dpm: { lbyr: dpm.lbyr, lbhr: dpm.lbhr } } : null }, [
          'Default factors: 40 CFR 1039.101 Table 1, Tier 4 Final generator sets above 900 kW (NOx 0.67, CO 3.5, NMHC 0.19, PM 0.03 g/kW-hr), converted with 0.7457 kW/hp. Permit Handbook Ch. 2.3.1 directs the use of CARB-certified, then EPA-certified, then manufacturer factors; if only NMHC+NOx is certified, take NOx as 95% and POC as 5%.',
          'Hours: the state ATCM allows a new emergency engine 50 hr/yr of maintenance and testing (100 hr/yr below 0.01 g/bhp-hr PM). Air District policy (June 3, 2019) adds 100 hr/yr of emergency operation to potential to emit for applicability, not for offsets or Rule 2-5.',
          'Brake-specific fuel consumption 7,000 Btu/bhp-hr: AP-42 Section 3.3, Table 3.3-1 footnote.',
          A.DATA.ghg.source,
        ], extra);
      },
    },
    {
      id: 'flare', group: 'Estimate emissions', title: 'Flare event',
      intro: 'Emissions from gas sent to a flare. Combustion products come from heat release; SO2 assumes all H2S burns to SO2; VOC is the fraction that survives the destruction efficiency. Volumes use the oil and gas 60 F basis. The same arithmetic checks the volumes operators report for flaring and venting exceptions.',
      fields: [
        { id: 'name', label: 'Event or source name', type: 'text', value: 'Flare F-1 event' },
        { id: 'mscf', label: 'Gas flared', unit: 'Mscf', value: 100 },
        { id: 'hrs', label: 'Event duration', unit: 'hours', value: 4 },
        { id: 'hhv', label: 'Higher heating value', unit: 'Btu/scf', value: 1000 },
        { id: 'h2s', label: 'H2S in gas', unit: 'ppmv', value: 100 },
        { id: 'vocpct', label: 'VOC (C3+) in gas', unit: 'mol %', value: 8 },
        { id: 'vocmw', label: 'Average VOC molecular weight', unit: 'lb/lb-mol', value: 52 },
        { id: 'dre', label: 'Destruction efficiency', unit: '%', value: 98 },
        { id: 'noxef', label: 'NOx factor', unit: 'lb/MMBtu', value: A.DATA.ap42Flare.NOx },
        { id: 'coef', label: 'CO factor', unit: 'lb/MMBtu', value: A.DATA.ap42Flare.CO },
      ],
      run(v) {
        const r = A.flare({ volumeMscf: v.mscf, hours: v.hrs, hhv: v.hhv, h2sPpm: v.h2s, vocMolPct: v.vocpct, vocMW: v.vocmw, dre: v.dre, noxEf: v.noxef, coEf: v.coef });
        const o = r.out;
        const rows = [['NOx', o.nox, o.noxHr], ['CO', o.co, o.coHr], ['SO2', o.so2, o.so2Hr], ['VOC (POC)', o.voc, o.vocHr]];
        return {
          flags: [{ level: 'info', text: `Heat released: <b>${fmt(o.heat)} MMBtu</b> from ${fmt(o.mol)} lb-mol of gas. VOC sent to flare ${fmt(o.vocIn)} lb, emitted ${fmt(o.voc)} lb.` }],
          tables: [{ head: ['Pollutant', 'Event total (lb)', 'Average rate (lb/hr)'], rows: rows.map((x) => [x[0], fmt(x[1]), x[2] === null ? 'n/a' : fmt(x[2])]) }],
          steps: r.steps,
          chart: { type: 'bars', items: rows.map((x) => ({ label: x[0], value: x[1] })), unit: 'lb per event' },
          sources: [A.DATA.ap42Flare.source, 'Molar volume 379.5 scf/lb-mol at 60 F and 14.696 psia.', 'Destruction efficiency of 98% is the common default for a properly operated flare (40 CFR 60.18 conditions); use the site-specific value.'],
        };
      },
    },
    {
      id: 'coating', group: 'Estimate emissions', title: 'Coating or solvent use',
      intro: 'VOC from coatings, inks, adhesives or solvents: material used times VOC content, reduced by capture and control. Enter VOC content as applied, less water and exempt compounds.',
      fields: [
        { id: 'name', label: 'Source name', type: 'text', value: 'S-3 Spray booth' },
        { id: 'gal', label: 'Annual material use', unit: 'gal/yr', value: 2000 },
        { id: 'maxgal', label: 'Maximum daily use', unit: 'gal/day', value: 20 },
        { id: 'gl', label: 'VOC content', unit: 'g/L less water and exempt compounds', value: 340, help: 'Converted to lb/gal in the worksheet (1 g/L = 0.008345 lb/gal).' },
        { id: 'days', label: 'Operating days', unit: 'days/yr', value: 250 },
        { id: 'cap', label: 'Capture efficiency', unit: '%', value: 0 },
        { id: 'des', label: 'Control device efficiency', unit: '%', value: 0 },
      ],
      run(v) {
        const lbgal = A.gPerLtoLbPerGal(+v.gl);
        const r = A.coating({ gallons: v.gal, vocLbGal: lbgal, capture: v.cap, destruction: v.des, daysYr: v.days, maxGalDay: v.maxgal });
        r.steps.unshift({ label: 'Convert VOC content', expr: `${v.gl} g/L x 3.7854 L/gal / 453.592 g/lb`, value: lbgal, unit: 'lb/gal' });
        const o = r.out;
        const rows = [{ pol: 'POC', lbhr: o.maxDay / 24, lbday: o.maxDay, lbyr: o.ctl, tpy: o.tpy }];
        return emissionsResult(v.name, { out: { rows }, steps: r.steps }, { mmbtu: 0, kind: 'coating' }, ['Mass balance: all VOC in the material is assumed to evaporate unless captured and destroyed. Daily value uses maximum daily use; hourly value is the daily value spread over 24 hours.']);
      },
    },
    {
      id: 'gdf', group: 'Estimate emissions', title: 'Gasoline dispensing',
      intro: 'Organic emissions from a retail gasoline station by throughput, using the Air District\'s per-gallon factors for stations with enhanced vapor recovery. Benzene follows from the organic total and drives the Rule 2-5 screening.',
      fields: [
        { id: 'name', label: 'Station name', type: 'text', value: 'GDF #1' },
        { id: 'thru', label: 'Gasoline throughput', unit: 'gal/yr', value: 1500000 },
        { id: 'maxday', label: 'Maximum daily throughput', unit: 'gal/day', value: 8000 },
        { id: 'maxhr', label: 'Maximum hourly throughput', unit: 'gal/hr', value: 1000, help: 'Sets the peak-hour benzene rate for the acute trigger.' },
        { id: 'orvr', label: 'Gallons dispensed to ORVR-equipped vehicles', unit: '%', value: 90, help: 'Onboard refueling vapor recovery is standard on light-duty vehicles built since about 2006.' },
        { id: 'bz', label: 'Benzene weight fraction of organic emissions', unit: 'fraction', value: 0.003, help: 'Your assumption. Use the speciation the Air District or CARB applies to the case.' },
        { id: 'nozzles', label: 'Nozzle-products (for fees)', unit: 'count', value: 12 },
      ],
      run(v) {
        const g = D.gdf;
        const steps = [];
        let ef = 0;
        const terms = [];
        const fo = Math.min(Math.max(+v.orvr, 0), 100) / 100;
        for (const c of g.components) {
          if (c.orvr) {
            const x = (1 - fo) * c.orvr.non + fo * c.orvr.orvr;
            steps.push({ label: c.name, expr: `${fmt(1 - fo)} x ${c.orvr.non} + ${fmt(fo)} x ${c.orvr.orvr}`, value: x, unit: 'lb/1,000 gal' }); ef += x; terms.push(fmt(x));
          } else { steps.push({ label: c.name, expr: 'CARB EVR factor', value: c.lbPerKgal, unit: 'lb/1,000 gal' }); ef += c.lbPerKgal; terms.push(fmt(c.lbPerKgal)); }
        }
        steps.push({ label: 'Total organic factor', expr: terms.join(' + '), value: ef, unit: 'lb/1,000 gal' });
        const lbyr = +v.thru / 1000 * ef;
        steps.push({ label: 'Annual POC', expr: `${fmt(+v.thru)} gal / 1,000 x ${fmt(ef)}`, value: lbyr, unit: 'lb/yr' });
        const lbday = +v.maxday / 1000 * ef;
        steps.push({ label: 'Maximum day POC', expr: `${fmt(+v.maxday)} / 1,000 x ${fmt(ef)}`, value: lbday, unit: 'lb/day' });
        const benz = lbyr * (+v.bz);
        steps.push({ label: 'Benzene', expr: `${fmt(lbyr)} x ${v.bz}`, value: benz, unit: 'lb/yr' });
        const pocHr = +v.maxhr / 1000 * ef;
        const benzHr = pocHr * (+v.bz);
        steps.push({ label: 'Peak-hour benzene', expr: `${fmt(+v.maxhr)} gal/hr / 1,000 x ${fmt(ef)} x ${v.bz}`, value: benzHr, unit: 'lb/hr' });
        const rows = [{ pol: 'POC', lbhr: pocHr, lbday, lbyr, tpy: lbyr / 2000 }];
        const t = D.tac.find((x) => x.key === 'benzene');
        const extra = [];
        if (t && t.chronicTrig) extra.push(benz > t.chronicTrig
          ? { level: 'warn', text: `<b>Benzene ${fmt(benz)} lb/yr exceeds the chronic trigger of ${t.chronicTrig} lb/yr.</b> A health risk assessment is required.` }
          : { level: 'ok', text: `Benzene ${fmt(benz)} lb/yr is below the chronic trigger of ${t.chronicTrig} lb/yr.` });
        if (t && t.acuteTrig) extra.push(benzHr > t.acuteTrig
          ? { level: 'warn', text: `<b>Peak-hour benzene ${fmt(benzHr)} lb/hr exceeds the acute trigger of ${t.acuteTrig} lb/hr.</b>` }
          : { level: 'ok', text: `Peak-hour benzene ${fmt(benzHr)} lb/hr is below the acute trigger of ${t.acuteTrig} lb/hr.` });
        return emissionsResult(v.name, { out: { rows }, steps }, { mmbtu: 0, kind: 'gdf', nozzles: +v.nozzles, tac: { benzene: { lbyr: benz, lbhr: benzHr } } }, [g.source], extra);
      },
    },
    {
      id: 'project', group: 'Review the project', title: 'BACT and offset triggers',
      intro: 'Sources you add from the emission calculators collect here. Each source is checked against the BACT trigger (Regulation 2-2-301) and the facility against the offset thresholds (2-2-302 and 2-2-303). Enter existing facility emissions so the offset check sees the whole facility.',
      custom: renderProject,
    },
    {
      id: 'toxics', group: 'Review the project', title: 'Toxics screening and risk',
      intro: 'Rule 2-5 review in four steps: compare each toxic air contaminant with its Table 2-5-1 trigger level, estimate concentrations with the Air District screening factor or a Gaussian plume for the stack, convert them to cancer risk and hazard indices with the OEHHA 2015 method, and compare with the TBACT and project risk limits.',
      custom: renderToxics,
    },
    {
      id: 'fees', group: 'Review the project', title: 'Permit fees',
      intro: 'Fees due with a new-source application under Regulation 3. Schedule B covers fuel-burning sources by maximum firing rate; Schedule D covers gasoline dispensing by nozzle. Fees change every July, so check the current schedule.',
      fields: [
        { id: 'sched', label: 'Fee schedule', type: 'select', options: [['B', 'Schedule B: combustion of fuel'], ['D', 'Schedule D: gasoline dispensing facility']], value: 'B' },
        { id: 'mm', label: 'Maximum firing rate (Schedule B)', unit: 'MMBtu/hr HHV', value: 5 },
        { id: 'raf', label: 'Risk assessment fee', type: 'select', options: [['none', 'Not required'], ['first', 'First TAC source in the application'], ['additional', 'Additional TAC source']], value: 'none' },
        { id: 'sur', label: 'Emits a TAC above a chronic trigger (10% toxic surcharge)', type: 'check', value: false },
        { id: 'solid', label: 'Burns coke, coal, wood, tires, black liquor or MSW (100% surcharge)', type: 'check', value: false },
        { id: 'school', label: 'Within 1,000 ft of a school, or HRA in an Overburdened Community (public notice)', type: 'check', value: false },
        { id: 'noz', label: 'Nozzle-products (Schedule D)', unit: 'count', value: 12 },
      ],
      run(v) {
        const r = v.sched === 'D' ? A.feesScheduleD({ nozzleProducts: v.noz }) : A.feesScheduleB({ mmbtu: v.mm, raf: v.raf, toxicSurcharge: v.sur, solidFuel: v.solid });
        const o = r.out;
        const items = v.sched === 'D'
          ? [['Filing fee', o.filing], ['Initial fee', o.init], ['Permit to operate fee', o.pto]]
          : [['Filing fee', o.filing], ['Initial fee', o.init], ['Risk assessment fee', o.raf], ['Permit to operate fee', o.pto], ['Toxic surcharge', o.sur], ['Solid-fuel surcharge', o.solid]].filter((x) => x[1] > 0 || x[0] !== 'Solid-fuel surcharge');
        const flags = [{ level: 'info', text: `<b>Total with application: $${money(o.total)}</b>. The permit to operate fee recurs each year at renewal.` }];
        if (v.school) flags.push({ level: 'warn', text: `Public notice applies: the Air District invoices a minimum of <b>$${money(D.fees.publicNotice)}</b>, plus <b>$${money(D.fees.obcHra)}</b> when an HRA is required in an Overburdened Community.` });
        return {
          flags,
          tables: [{ head: ['Fee', 'Amount'], rows: items.map((x) => [x[0], '$' + money(x[1])]).concat([['Total', '$' + money(o.total)]]) }],
          steps: r.steps,
          chart: { type: 'bars', items: items.filter((x) => x[1] > 0).map((x) => ({ label: x[0].replace(' fee', ''), value: x[1] })), unit: 'dollars' },
          sources: [D.fees.source],
        };
      },
    },
    {
      id: 'units', group: 'Check the math', title: 'Unit conversions',
      intro: 'Turn a stack concentration into a mass rate the way Method 19 does: correct to reference oxygen, convert ppm to mass per dry standard cubic foot, then to lb/MMBtu with the fuel F-factor.',
      fields: [
        { id: 'ppm', label: 'Measured concentration', unit: 'ppmvd', value: 9 },
        { id: 'pol', label: 'Pollutant', type: 'select', options: [['NOx', 'NOx (as NO2, MW 46.01)'], ['CO', 'CO (MW 28.01)'], ['SO2', 'SO2 (MW 64.06)'], ['NH3', 'NH3 (MW 17.03)'], ['VOC_as_CH4', 'VOC as methane (MW 16.04)']], value: 'NOx' },
        { id: 'o2m', label: 'O2 at measurement', unit: '% dry', value: 3 },
        { id: 'o2r', label: 'Reference O2', unit: '% (3 boilers, 15 turbines and engines)', value: 3 },
        { id: 'fuel', label: 'Fuel (F-factor)', type: 'select', options: Object.keys(A.DATA.fd).filter((k) => k !== 'source'), value: 'Natural gas' },
        { id: 'heat', label: 'Firing rate (optional, for lb/hr)', unit: 'MMBtu/hr', value: 5 },
      ],
      run(v) {
        const r = A.concConvert({ ppm: v.ppm, mw: A.K.MW[v.pol], o2meas: v.o2m, o2ref: v.o2r, fd: A.DATA.fd[v.fuel], heat: v.heat });
        const o = r.out;
        const rows = [[`ppmvd @ ${v.o2r}% O2`, fmt(o.ppmRef)], ['lb/MMBtu', fmt(o.lbPerMMBtu)], ['mg/m3 (25 C, at measured O2)', fmt(o.mgm3)]];
        if (o.lbhr !== null) rows.push(['lb/hr at the firing rate', fmt(o.lbhr)]);
        return { flags: [], tables: [{ head: ['Result', 'Value'], rows }], steps: r.steps, sources: [A.DATA.fd.source, 'EPA Method 19 Equation 19-1: E = C x Fd x 20.9 / (20.9 - %O2). Molar volume 385.3 scf/lb-mol at 68 F.'] };
      },
    },
    {
      id: 'control', group: 'Check the math', title: 'Control efficiency',
      intro: 'Overall control is capture times the efficiency of the control train. A second device in series treats only the captured stream, so overall control can never exceed capture efficiency. A common error is applying 95% destruction when only 90% of the stream reaches the device.',
      fields: [
        { id: 'unc', label: 'Uncontrolled emissions', unit: 'lb/day', value: 100 },
        { id: 'cap', label: 'Capture efficiency', unit: '%', value: 90 },
        { id: 'des', label: 'Control device efficiency', unit: '%', value: 95 },
        { id: 'sec', label: 'Second device in series (optional)', unit: '%', value: 0 },
      ],
      run(v) {
        const r = A.controlEff({ uncontrolled: v.unc, capture: v.cap, destruction: v.des, secondary: v.sec, unit: 'lb/day' });
        return {
          flags: [{ level: 'info', text: `Overall control <b>${fmt(r.out.overall * 100, 2)}%</b>; <b>${fmt(100 - r.out.overall * 100, 2)}%</b> of the uncontrolled emissions remain.` }],
          tables: [{ head: ['Result', 'Value'], rows: [['Overall control', fmt(r.out.overall * 100, 2) + ' %'], ['Controlled emissions', fmt(r.out.residual) + ' lb/day']] }],
          steps: r.steps, sources: ['Do not apply a control efficiency to a factor that already reflects that control.'],
        };
      },
    },
    { id: 'about', group: 'Check the math', title: 'Methods and sources', custom: renderAbout },
  ];

  // ---------- Shared result builder for emission modules ----------
  function emissionsResult(name, r, meta, sources, extraFlags) {
    const rows = r.out.rows;
    const flags = (extraFlags || []).slice();
    const bact = D.nsr.bactLbDay;
    const over = rows.filter((x) => x.lbday >= bact);
    flags.unshift(over.length
      ? { level: 'warn', text: `<b>BACT is triggered for ${over.map((x) => x.pol).join(', ')}</b>: potential to emit is ${bact} lb or more on the highest day (Regulation 2-2-301).` }
      : { level: 'ok', text: `No pollutant reaches the BACT trigger of ${bact} lb on the highest day.` });
    if (meta.co2e) flags.push({ level: 'info', text: `Greenhouse gases: <b>${fmt(meta.co2e)} metric tons CO2e/yr</b> (Schedule T fee about $${money(meta.co2e * A.DATA.ghg.feePerMT)}).` });
    const tableRows = rows.map((x) => [x.pol, fmt(x.ef === undefined ? NaN : x.ef).replace('NaN', ''), fmt(x.lbhr), { v: fmt(x.lbday), cls: x.lbday >= bact ? 'hit' : '' }, fmt(x.lbyr), fmt(x.tpy)]);
    const hasEf = rows.some((x) => x.ef !== undefined);
    const head = ['Pollutant', hasEf ? 'Factor' : '', 'lb/hr', 'lb/day (max)', 'lb/yr', 'ton/yr'];
    return {
      flags,
      tables: [{ head: hasEf ? head : head.filter((h, i) => i !== 1), rows: hasEf ? tableRows : tableRows.map((r2) => r2.filter((c, i) => i !== 1)) }],
      steps: r.steps,
      chart: { type: 'bars', items: rows.map((x) => ({ label: x.pol, value: x.lbday })), unit: 'lb on the highest day', line: { value: bact, label: 'BACT trigger' } },
      sources,
      project: { name, kind: meta.kind, mmbtu: meta.mmbtu || 0, nozzles: meta.nozzles || 0, co2e: meta.co2e || 0, tac: meta.tac || null, pol: Object.fromEntries(rows.map((x) => [x.pol, { lbday: x.lbday, tpy: x.tpy }])) },
    };
  }

  const money = (x) => Number(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ---------- Rendering ----------
  function renderNav(active) {
    const groups = [];
    for (const m of MODULES) { let g = groups.find((x) => x.name === m.group); if (!g) groups.push(g = { name: m.group, items: [] }); g.items.push(m); }
    $('#nav').innerHTML = groups.map((g) => `<div class="nav-group"><h2>${esc(g.name)}</h2><ul>${g.items.map((m) => `<li><button class="nav-btn" data-id="${m.id}"${m.id === active ? ' aria-current="page"' : ''}>${esc(m.title)}</button></li>`).join('')}</ul></div>`).join('');
    $('#nav').onclick = (e) => { const b = e.target.closest('.nav-btn'); if (b) go(b.dataset.id); };
    const list = store.get();
    const pill = $('#projectPill');
    if (list.length) {
      pill.hidden = false;
      pill.innerHTML = `<b>Project:</b> ${list.length} source${list.length > 1 ? 's' : ''}<br><button class="btn ghost" data-go="project">Review triggers</button>`;
      pill.querySelector('button').onclick = () => go('project');
    } else pill.hidden = true;
  }

  function fieldHtml(f, val) {
    if (f.legend) return `</fieldset><fieldset><legend>${esc(f.legend)}</legend>`;
    const id = 'f_' + f.id;
    const unit = f.unit ? ` <span class="u">(${esc(f.unit)})</span>` : '';
    const help = f.help ? `<div class="help">${esc(f.help)}</div>` : '';
    if (f.type === 'select') {
      const opts = f.options.map((o) => Array.isArray(o) ? o : [o, o]);
      return `<div class="fld"><label for="${id}">${esc(f.label)}${unit}</label><select id="${id}" data-k="${f.id}">${opts.map((o) => `<option value="${esc(o[0])}"${String(val) === String(o[0]) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>${help}</div>`;
    }
    if (f.type === 'check') return `<div class="fld check"><label><input type="checkbox" id="${id}" data-k="${f.id}"${val === true || val === 'true' ? ' checked' : ''}> <span>${esc(f.label)}</span></label>${help}</div>`;
    const t = f.type === 'text' ? 'text' : 'number';
    return `<div class="fld"><label for="${id}">${esc(f.label)}${unit}</label><input id="${id}" data-k="${f.id}" type="${t}" ${t === 'number' ? 'step="any" inputmode="decimal"' : ''} value="${esc(val)}">${help}</div>`;
  }

  function readFields(root, mod) {
    const v = {};
    for (const f of mod.fields) {
      if (f.legend) continue;
      const el = root.querySelector(`[data-k="${f.id}"]`);
      v[f.id] = f.type === 'check' ? el.checked : el.value;
    }
    return v;
  }

  function sheetHtml(res) {
    let h = '<div class="sheet">';
    if (res.flags && res.flags.length) h += `<div class="sheet-sec"><div class="flags" role="status">${res.flags.map((f) => `<div class="flag ${f.level}">${f.text}</div>`).join('')}</div></div>`;
    for (const t of res.tables || []) {
      h += `<div class="sheet-sec">${t.title ? `<h3>${esc(t.title)}</h3>` : ''}<div class="table-wrap"><table class="res"><thead><tr>${t.head.map((x) => `<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((c) => (c && typeof c === 'object') ? `<td class="${c.cls}">${esc(c.v)}</td>` : `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    }
    if (res.chart) h += `<div class="sheet-sec"><h3>${esc(res.chartTitle || 'Chart')}</h3><canvas class="chart" aria-label="Chart of results" role="img"></canvas></div>`;
    if (res.steps && res.steps.length) h += `<div class="sheet-sec"><h3>Calculation trail</h3><ol class="trail">${res.steps.map((s) => `<li><span class="what">${esc(s.label)}</span><span class="val">${esc(typeof s.value === 'number' ? fmt(s.value) : s.value)}<small>${esc(s.unit)}</small></span><span class="expr">${esc(s.expr)}</span></li>`).join('')}</ol></div>`;
    if (res.sources && res.sources.length) h += `<div class="sheet-sec"><h3>Sources and assumptions</h3><ul class="src">${res.sources.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>`;
    return h + '</div>';
  }

  function trailText(mod, res) {
    const lines = [`${mod.title} (Air Permit Engineering Toolkit)`, location.href, ''];
    for (const t of res.tables || []) { lines.push(t.head.join(' | ')); for (const r of t.rows) lines.push(r.map((c) => (c && typeof c === 'object') ? c.v : c).join(' | ')); lines.push(''); }
    (res.steps || []).forEach((s, i) => lines.push(`${i + 1}. ${s.label}: ${s.expr} = ${typeof s.value === 'number' ? fmt(s.value) : s.value} ${s.unit}`));
    lines.push('', 'Sources:'); (res.sources || []).forEach((s) => lines.push('- ' + s));
    return lines.join('\n');
  }

  function go(id, params) {
    const mod = MODULES.find((m) => m.id === id) || MODULES[0];
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    if (location.hash !== '#' + mod.id + q) history.replaceState(null, '', '#' + mod.id + q);
    renderNav(mod.id);
    const view = $('#view');
    const head = `<div class="mod-head"><h2>${esc(mod.title)}</h2>${mod.intro ? `<p>${esc(mod.intro)}</p>` : ''}</div>`;
    if (mod.custom) { view.innerHTML = head + '<div id="custom"></div>'; mod.custom($('#custom'), params || {}); return; }
    const vals = {};
    for (const f of mod.fields) if (!f.legend) vals[f.id] = params && params[f.id] !== undefined ? params[f.id] : f.value;
    const fields = mod.fields.map((f) => fieldHtml(f, vals[f.id])).join('');
    view.innerHTML = head + `<div class="mod-grid"><form class="inputs" novalidate><fieldset>${fields}</fieldset>
      <div class="btn-row"><button type="button" class="btn" data-act="add" hidden>Add to project</button><button type="button" class="btn ghost" data-act="copy">Copy worksheet</button><button type="button" class="btn ghost" data-act="reset">Reset</button></div></form><div class="out" aria-live="polite"></div></div>`;
    const form = $('.inputs', view);
    const out = $('.out', view);
    let last = null;
    const update = () => {
      const v = readFields(form, mod);
      try {
        last = mod.run(v);
        last.chartTitle = last.chart && last.chart.unit ? 'Results, ' + last.chart.unit : 'Chart';
        out.innerHTML = sheetHtml(last);
        if (last.chart) drawChart($('canvas', out), last.chart);
        $('[data-act="add"]', form).hidden = !last.project;
        history.replaceState(null, '', '#' + mod.id + '?' + new URLSearchParams(v).toString());
      } catch (e) {
        last = null;
        out.innerHTML = `<div class="sheet"><div class="sheet-sec"><p class="err">${esc(e.message)}</p></div></div>`;
      }
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('click', (e) => {
      const act = e.target.dataset && e.target.dataset.act;
      if (act === 'reset') { go(mod.id); }
      if (act === 'copy' && last) copy(trailText(mod, last), e.target);
      if (act === 'add' && last && last.project) {
        const list = store.get().slice();
        list.push(Object.assign({ id: Date.now() }, last.project));
        store.save(list); renderNav(mod.id);
        e.target.textContent = 'Added'; setTimeout(() => { e.target.textContent = 'Add to project'; }, 1400);
      }
    });
    update();
  }

  function copy(text, btn) {
    const done = () => { const t = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = t; }, 1400); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ } ta.remove(); }
  }

  // ---------- Project / NSR triggers ----------
  function renderProject(root) {
    const list = store.get();
    const n = D.nsr;
    let existing = {};
    try { existing = JSON.parse(localStorage.getItem('apt-existing') || '{}'); } catch (e) { existing = {}; }
    const draw = () => {
      const fac = {}; const proj = {};
      for (const p of POLS) { proj[p] = 0; fac[p] = Number(existing[p] || 0); }
      for (const s of list) for (const p of POLS) if (s.pol[p]) proj[p] += s.pol[p].tpy;
      for (const p of POLS) fac[p] += proj[p];
      const flags = [];
      const bactHits = [];
      for (const s of list) for (const p of POLS) if (s.pol[p] && s.pol[p].lbday >= n.bactLbDay) bactHits.push(`${s.name}: ${p}`);
      flags.push(bactHits.length ? { level: 'warn', text: `<b>BACT required</b> (2-2-301, ${n.bactLbDay} lb on any day): ${bactHits.map(esc).join('; ')}.` } : { level: 'ok', text: list.length ? 'No source reaches the BACT trigger.' : 'No sources yet. Use an emission calculator and press Add to project.' });
      for (const rule of n.offsets) {
        const tot = rule.pols.reduce((a, p) => Math.max(a, fac[p] || 0), 0);
        const hit = rule.pols.filter((p) => (rule.ge ? (fac[p] || 0) >= rule.tpy : (fac[p] || 0) > rule.tpy) && (rule.below === undefined || (fac[p] || 0) < rule.below));
        if (!hit.length && rule.below !== undefined && tot >= rule.below) continue;
        const word = rule.ge ? 'is at or above' : 'exceeds';
        if (hit.length) flags.push({ level: 'warn', text: `<b>${esc(rule.label)}</b>: facility ${hit.map((p) => `${p} ${fmt(fac[p])} tpy`).join(', ')} ${word} ${rule.tpy} tpy. ${esc(rule.then)}` });
        else flags.push({ level: 'ok', text: `${esc(rule.label)}: facility ${rule.ge ? 'below' : 'at or below'} ${rule.tpy} tpy (highest ${fmt(tot)} tpy).` });
      }
      const rows = list.map((s) => [s.name].concat(POLS.map((p) => s.pol[p] ? { v: fmt(s.pol[p].lbday), cls: s.pol[p].lbday >= n.bactLbDay ? 'hit' : '' } : '')).concat([{ v: 'Remove', cls: 'rm', id: s.id }]));
      const tpyRows = [['Project increase'].concat(POLS.map((p) => fmt(proj[p]))), ['Existing facility'].concat(POLS.map((p) => fmt(Number(existing[p] || 0)))), ['Facility total'].concat(POLS.map((p) => fmt(fac[p])))];
      root.innerHTML = `<div class="mod-grid"><form class="inputs"><fieldset><legend>Existing facility potential to emit (ton/yr)</legend>${POLS.map((p) => `<div class="fld"><label for="ex_${p}">${p}</label><input id="ex_${p}" data-p="${p}" type="number" step="any" value="${esc(existing[p] || 0)}"></div>`).join('')}</fieldset>
        <div class="btn-row"><button type="button" class="btn ghost" data-act="clear">Clear project</button></div></form>
        <div class="out">${sheetHtml({ flags, tables: [] })}
        <div class="sheet" style="margin-top:14px"><div class="sheet-sec"><h3>Sources, lb on the highest day</h3><div class="table-wrap"><table class="res"><thead><tr><th>Source</th>${POLS.map((p) => `<th>${p}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => c && typeof c === 'object' ? (c.cls === 'rm' ? `<td><button class="btn ghost" data-rm="${c.id}">Remove</button></td>` : `<td class="${c.cls}">${esc(c.v)}</td>`) : `<td>${esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${POLS.length + 2}">No sources added yet.</td></tr>`}</tbody></table></div></div>
        <div class="sheet-sec"><h3>Facility, ton/yr</h3><div class="table-wrap"><table class="res"><thead><tr><th></th>${POLS.map((p) => `<th>${p}</th>`).join('')}</tr></thead><tbody>${tpyRows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>
        <div class="sheet-sec"><h3>Sources and assumptions</h3><ul class="src">${n.sources.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div></div></div></div>`;
      root.querySelectorAll('[data-p]').forEach((el) => el.addEventListener('change', () => { existing[el.dataset.p] = el.value; try { localStorage.setItem('apt-existing', JSON.stringify(existing)); } catch (e) { /* ignore */ } draw(); }));
      root.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { const i = list.findIndex((s) => String(s.id) === b.dataset.rm); if (i >= 0) list.splice(i, 1); store.save(list); renderNav('project'); draw(); }));
      $('[data-act="clear"]', root).onclick = () => { list.splice(0); store.save(list); renderNav('project'); draw(); };
    };
    draw();
  }

  // ---------- Toxics ----------
  function renderToxics(root, params) {
    const tacOpts = D.tac.map((t) => [t.key, t.name]);
    const projTac = {};
    for (const s of store.get()) if (s.tac) for (const [k, x] of Object.entries(s.tac)) { projTac[k] = projTac[k] || { lbyr: 0, lbhr: 0 }; projTac[k].lbyr += x.lbyr; projTac[k].lbhr += x.lbhr; }
    const pre = Object.entries(projTac);
    const has = (k) => Object.prototype.hasOwnProperty.call(params, k);
    const fromLink = has('t0');
    const rowsInit = [0, 1, 2, 3].map((i) => fromLink
      ? { key: params['t' + i] || '', lbyr: has('y' + i) ? params['y' + i] : '', lbhr: has('h' + i) ? params['h' + i] : '' }
      : { key: pre[i] ? pre[i][0] : (i === 0 && !pre.length ? 'dpm' : ''), lbyr: pre[i] ? +pre[i][1].lbyr.toPrecision(4) : (i === 0 && !pre.length ? 1.4 : ''), lbhr: pre[i] ? +pre[i][1].lbhr.toPrecision(4) : (i === 0 && !pre.length ? 0.03 : '') });
    const disp = Object.assign({ meth: 'ceqa', hs: 3, wind: 1, stab: 'F', terr: 'urban', rec: 50, pr: false, vs: 40, diam: 0.2, ts: 750, aqmd: false }, params);
    root.innerHTML = `<div class="mod-grid"><form class="inputs" novalidate>
      <fieldset><legend>Step 1. Toxic emissions from the project</legend>
      ${rowsInit.map((r, i) => `<div class="fld"><label for="t${i}">Contaminant ${i + 1}</label><select id="t${i}" data-k="t${i}"><option value="">(none)</option>${tacOpts.map((o) => `<option value="${o[0]}"${o[0] === r.key ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></div>
        <div class="fld" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label for="y${i}">lb/yr</label><input id="y${i}" data-k="y${i}" type="number" step="any" value="${esc(r.lbyr)}"></div><div><label for="h${i}">max lb/hr</label><input id="h${i}" data-k="h${i}" type="number" step="any" value="${esc(r.lbhr)}"></div></div>`).join('')}
      </fieldset>
      <fieldset><legend>Step 2. Screening dispersion (one stack)</legend>
        <div class="fld"><label for="meth">Annual concentration method</label><select id="meth" data-k="meth"><option value="ceqa"${disp.meth !== 'plume' ? ' selected' : ''}>Air District screening value: 360 ug/m3 per g/s</option><option value="plume"${disp.meth === 'plume' ? ' selected' : ''}>Gaussian plume for this stack (more conservative for low stacks)</option></select><div class="help">The fixed value is the one in the Air District CEQA Health Risk Calculator 5.0. The plume settings below always set the acute (1-hour) value.</div></div>
        <div class="fld"><label for="hs">Stack height <span class="u">(m)</span></label><input id="hs" data-k="hs" type="number" step="any" value="${esc(disp.hs)}"></div>
        <div class="fld"><label for="wind">Wind speed <span class="u">(m/s)</span></label><input id="wind" data-k="wind" type="number" step="any" value="${esc(disp.wind)}"></div>
        <div class="fld"><label for="stab">Stability class</label><select id="stab" data-k="stab">${['A', 'B', 'C', 'D', 'E', 'F'].map((c) => `<option${c === disp.stab ? ' selected' : ''}>${c}</option>`).join('')}</select><div class="help">F with 1 m/s is a common worst case for low stacks.</div></div>
        <div class="fld"><label for="terr">Dispersion setting</label><select id="terr" data-k="terr"><option value="urban"${disp.terr === 'urban' ? ' selected' : ''}>Urban (Briggs urban sigmas)</option><option value="rural"${disp.terr === 'rural' ? ' selected' : ''}>Rural (Briggs rural sigmas)</option></select></div>
        <div class="fld"><label for="rec">Nearest receptor distance <span class="u">(m)</span></label><input id="rec" data-k="rec" type="number" step="any" value="${esc(disp.rec)}"><div class="help">Risk uses the larger of the receptor value and the off-site maximum beyond it.</div></div>
        <div class="fld check"><label><input type="checkbox" id="pr" data-k="pr"${disp.pr === true || disp.pr === 'true' ? ' checked' : ''}> <span>Include Briggs buoyant plume rise (less conservative)</span></label></div>
        <div class="fld" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div><label for="vs">Exit m/s</label><input id="vs" data-k="vs" type="number" step="any" value="${esc(disp.vs)}"></div><div><label for="diam">Diam. m</label><input id="diam" data-k="diam" type="number" step="any" value="${esc(disp.diam)}"></div><div><label for="ts">Exit K</label><input id="ts" data-k="ts" type="number" step="any" value="${esc(disp.ts)}"></div></div>
      </fieldset>
      <fieldset><legend>Step 3. Exposure assumptions</legend>
        <p class="help">Residential exposure: 30 years, breathing rates 361, 1,090, 572 and 261 L/kg-day by age group, as in the Air District CEQA Health Risk Calculator 5.0.</p>
        <div class="fld check"><label><input type="checkbox" id="aqmd" data-k="aqmd"${disp.aqmd === true || disp.aqmd === 'true' ? ' checked' : ''}> <span>Project is in an Overburdened Community (6 in a million limit)</span></label></div>
      </fieldset>
      <div class="btn-row"><button type="button" class="btn ghost" data-act="copy">Copy worksheet</button></div>
      </form><div class="out" aria-live="polite"></div></div>`;
    const form = $('form', root); const out = $('.out', root);
    let last = null;
    const update = () => {
      const v = {};
      form.querySelectorAll('[data-k]').forEach((el) => { v[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; });
      try { last = toxicsRun(v); out.innerHTML = sheetHtml(last); drawChart($('canvas', out), last.chart); history.replaceState(null, '', '#toxics?' + new URLSearchParams(v).toString()); }
      catch (e) { out.innerHTML = `<div class="sheet"><div class="sheet-sec"><p class="err">${esc(e.message)}</p></div></div>`; }
    };
    form.addEventListener('input', update); form.addEventListener('change', update);
    form.addEventListener('click', (e) => { if (e.target.dataset.act === 'copy' && last) copy(trailText({ title: 'Toxics screening and risk' }, last), e.target); });
    update();
  }

  function toxicsRun(v) {
    const steps = []; const flags = []; const rows = [];
    const H = A.dispersion({ stackHt: v.hs, wind: v.wind, stability: v.stab, terrain: v.terr, receptor: v.rec, plumeRise: v.pr, vs: v.vs, diam: v.diam, Ts: v.ts, Ta: 293, lbhr: 1 });
    // Concentration per g/s at the receptor: the larger of the receptor and the maximum beyond it.
    const xr = Math.max(+v.rec || 0, 1);
    let chi = 0, xAt = xr;
    for (const p of H.out.curve) if (p.x >= xr && p.c > chi) { chi = p.c; xAt = p.x; }
    const chiR = A.chiOverQ(xr, H.out.H, Math.max(+v.wind, 0.5), v.stab, v.terr);
    if (chiR > chi) { chi = chiR; xAt = xr; }
    steps.push(...H.steps.filter((s) => /plume rise|Effective/.test(s.label)));
    steps.push({ label: `Worst 1-hour chi/Q at or beyond ${fmt(xr, 0)} m (found at ${fmt(xAt, 0)} m)`, expr: `Gaussian plume, class ${v.stab}, ${v.wind} m/s, ${v.terr}`, value: chi, unit: 'ug/m3 per g/s' });
    const ceqa = v.meth !== 'plume';
    const chiAnn = ceqa ? D.ceqaChiQ : chi * 0.1;
    steps.push(ceqa
      ? { label: 'Annual chi/Q (Air District CEQA screening value)', expr: 'fixed value used in the Health Risk Calculator 5.0; acute uses the plume 1-hour value above', value: chiAnn, unit: 'ug/m3 per g/s' }
      : { label: 'Annual chi/Q', expr: `${fmt(chi)} x 0.1 (AERSCREEN annual factor)`, value: chiAnn, unit: 'ug/m3 per g/s' });
    const rf = A.residentFactor();
    steps.push({ label: 'Residential exposure factor', expr: `(${A.RESIDENT_BINS.map((b) => `${b.DBR}x${b.ASF}x${b.ED}x${b.FAH}`).join(' + ')}) x 350/365 x 1e-6 / 70`, value: rf, unit: 'per (ug/m3 x CPF)' });
    let risk = 0, hic = 0, hia = 0, worker = 0;
    let anyTrig = false;
    for (let i = 0; i < 4; i++) {
      const t = D.tac.find((x) => x.key === v['t' + i]); if (!t) continue;
      const lbyr = Math.max(+v['y' + i] || 0, 0), lbhr = Math.max(+v['h' + i] || 0, 0);
      const gsAnn = lbyr * A.K.G_PER_LB / (8760 * 3600), gsHr = lbhr * A.K.G_PER_LB / 3600;
      const cAnn = gsAnn * chiAnn, cHr = gsHr * chi;
      const r = cAnn * t.cpf * rf * 1e6;
      const w = cAnn * t.cpf * A.workerFactor(1) * 1e6;
      const hc = t.crel ? cAnn / t.crel : 0;
      const ha = t.arel ? cHr / t.arel : 0;
      risk += r; worker += w; hic += hc; hia += ha;
      const overC = t.chronicTrig !== null && lbyr > t.chronicTrig;
      const overA = t.acuteTrig !== null && lbhr > t.acuteTrig;
      if (overC || overA) anyTrig = true;
      steps.push({ label: `${t.name}: annual concentration`, expr: `${fmt(lbyr)} lb/yr = ${fmt(gsAnn)} g/s; x ${fmt(chiAnn)}`, value: cAnn, unit: 'ug/m3' });
      if (t.cpf) steps.push({ label: `${t.name}: residential cancer risk`, expr: `${fmt(cAnn)} x CPF ${t.cpf} x ${fmt(rf)} x 1e6`, value: r, unit: 'in a million' });
      if (t.crel) steps.push({ label: `${t.name}: chronic hazard`, expr: `${fmt(cAnn)} / REL ${t.crel}`, value: hc, unit: '' });
      if (t.arel) steps.push({ label: `${t.name}: acute hazard`, expr: `${fmt(lbhr)} lb/hr = ${fmt(gsHr)} g/s; x ${fmt(chi)} / REL ${t.arel}`, value: ha, unit: '' });
      rows.push([t.name, { v: fmt(lbyr), cls: overC ? 'hit' : '' }, t.chronicTrig === null ? 'none' : fmt(t.chronicTrig), { v: fmt(lbhr), cls: overA ? 'hit' : '' }, t.acuteTrig === null ? 'none' : fmt(t.acuteTrig), fmt(r), fmt(hc)]);
    }
    if (!rows.length) throw new Error('Choose at least one toxic air contaminant.');
    const lim = D.rule25;
    const projLimit = v.aqmd ? lim.projectCancerOBC : lim.projectCancer;
    flags.push(anyTrig ? { level: 'warn', text: '<b>At least one contaminant exceeds a Table 2-5-1 trigger level.</b> Rule 2-5 requires a health risk assessment; the screening below estimates its result.' } : { level: 'ok', text: 'All contaminants are below their Table 2-5-1 trigger levels, so no health risk assessment is needed for these emissions. Risk is shown for information.' });
    const tb = [];
    if (risk > lim.tbactCancer) tb.push(`cancer risk ${fmt(risk)} in a million is above ${lim.tbactCancer.toFixed(1)}`);
    if (hic > lim.tbactHI) tb.push(`chronic HI ${fmt(hic)} is above ${lim.tbactHI.toFixed(2)}`);
    flags.push(tb.length
      ? { level: 'warn', text: `<b>TBACT required</b> (2-5-301): ${tb.join(' and ')}.` }
      : { level: 'ok', text: `Below the TBACT triggers (2-5-301): risk ${fmt(risk)} in a million, chronic HI ${fmt(hic)}.` });
    const overProj = risk > projLimit || hic > lim.projectHI || hia > lim.projectHI;
    flags.push(overProj
      ? { level: 'stop', text: `<b>Screening estimate is above a project limit</b> (2-5-302): cancer ${fmt(risk)} vs ${projLimit} in a million, chronic HI ${fmt(hic)} and acute HI ${fmt(hia)} vs ${lim.projectHI}. Screening is deliberately conservative: the next step is a refined HRA (AERMOD with HARP 2), then controls or project changes if the refined result still exceeds the limit.` }
      : { level: 'ok', text: `Within the project limits (2-5-302): cancer ${fmt(risk)} of ${projLimit} in a million, chronic HI ${fmt(hic)} and acute HI ${fmt(hia)} of ${lim.projectHI}.` });
    flags.push({ level: 'info', text: `Worker cancer risk at the same point: ${fmt(worker)} in a million (8-hour breathing rate 230 L/kg, 250 days/yr, 25 years).` });
    return {
      flags,
      tables: [{ head: ['Contaminant', 'lb/yr', 'Trigger lb/yr', 'lb/hr', 'Trigger lb/hr', 'Risk per million', 'Chronic HI'], rows: rows.concat([['Total', '', '', '', '', fmt(risk), fmt(hic)]]) }],
      steps,
      chart: { type: 'line', points: H.out.curve.map((p) => ({ x: p.x, y: p.c })), unit: '1-hour ug/m3 per g/s vs distance (m)', mark: xAt },
      chartTitle: 'Plume model: 1-hour chi/Q by downwind distance',
      sources: [lim.source, D.tacSource, 'Exposure: OEHHA (2015) Air Toxics Hot Spots Program Guidance Manual for Preparation of Health Risk Assessments; residential 30-year exposure with age sensitivity factors 10, 10, 3 and 1, fraction of time at home 1 below age 16 and 0.73 for ages 16 to 30, 350 days/yr, 70-year averaging time.', 'Dispersion: Gaussian plume, ground-level centerline, Briggs (1973) dispersion coefficients as tabulated in Turner (1994) Workbook of Atmospheric Dispersion Estimates; annual = 0.1 x 1-hour max per EPA AERSCREEN guidance. This screen does not model building downwash, terrain or real meteorology and is not a substitute for AERMOD and HARP 2.'],
    };
  }

  // ---------- About ----------
  function renderAbout(root) {
    root.innerHTML = `<div class="prose">
      <p>This toolkit puts the routine arithmetic of an air permit evaluation in one place and shows each step, so an applicant, a reviewer or a member of the public can follow how a number was reached. It complements, and does not replace, the Air District's own resources:</p>
      <table><thead><tr><th>Air District resource</th><th>What it does</th><th>What this toolkit adds</th></tr></thead><tbody>
      <tr><td><a href="https://www.baaqmd.gov/en/permits/permitting-manuals/permit-handbook">Permit Handbook</a> (316-page PDF, 2024)</td><td>Source-category guidance and calculation methods</td><td>Working calculators for the common categories, with the arithmetic shown</td></tr>
      <tr><td><a href="https://www.baaqmd.gov/en/permits/permitting-manuals/bact-tbact-workbook">BACT/TBACT Workbook</a></td><td>Control technology determinations by source type</td><td>Checks whether BACT or TBACT is triggered at all</td></tr>
      <tr><td><a href="https://www.baaqmd.gov/en/plans-and-climate/california-environmental-quality-act-ceqa/ceqa-tools/health-risk-screening-and-modeling">Health Risk Calculator 5.0</a> (Excel, 2022)</td><td>CEQA screening risk from facility emissions with a fixed dispersion factor and distance multipliers</td><td>Permit-side Rule 2-5 screen: trigger levels, a stack-specific screening plume, TBACT and project limits</td></tr>
      <tr><td><a href="https://www.baaqmd.gov/en/rules-and-compliance/rules/reg-3-fees">Regulation 3</a> and the engine fee example</td><td>Fee schedules</td><td>Fee totals with minimums, maximums and surcharges applied</td></tr>
      </tbody></table>
      <h3>How to use it</h3>
      <p>Start with an emission calculator, press Add to project, repeat for each source, then open BACT and offset triggers, Toxics screening and Permit fees. Every calculator keeps its inputs in the page address, so a link reproduces the exact case. Copy worksheet puts the full calculation trail on the clipboard for a memo or an evaluation report.</p>
      <h3>Verification</h3>
      <p>The repository includes <code>tests/verify.mjs</code>, which checks each function against hand calculations and published values (for example, 9 ppmvd NOx at 3% O2 on natural gas equals about 0.011 lb/MMBtu, and the residential exposure factor matches the factor inside the Air District's CEQA calculator). The full equations are in <a href="https://github.com/Kouroshie/air-permit-toolkit/blob/main/METHODS.md">METHODS.md</a>.</p>
      <h3>Limits</h3>
      <p>Thresholds and fees come from the rule versions named on each page. Rules change, especially fees every July. The dispersion screen is deliberately simple and conservative for low stacks; it is not AERMOD. Treat every result as a check on an application, not as a permit decision.</p>
      <h3>Data version</h3><p>${esc(D.version)}</p>
    </div>`;
  }

  // ---------- Charts (canvas, no libraries) ----------
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  let lastChart = null;
  function drawChart(cv, spec) {
    if (!cv || !spec) return;
    lastChart = spec;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth || 600, Hh = cv.clientHeight || 260;
    cv.width = W * dpr; cv.height = Hh * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const ink = css('--ink'), muted = css('--muted'), rule = css('--rule'), bay = css('--bay'), flag = css('--flag');
    g.font = '12px "Public Sans", system-ui, sans-serif';
    const L = 56, R = 14, T = 14, B = 34;
    const pw = W - L - R, ph = Hh - T - B;
    if (spec.type === 'bars') {
      const items = spec.items.filter((x) => isFinite(x.value));
      let max = Math.max(...items.map((x) => x.value), spec.line ? spec.line.value * 1.15 : 0, 1e-9);
      const nice = niceMax(max); max = nice;
      axisY(g, L, T, pw, ph, 0, max, muted, rule, false);
      const bw = pw / items.length;
      items.forEach((x, i) => {
        const h = x.value / max * ph;
        const hit = spec.line && x.value >= spec.line.value;
        g.fillStyle = hit ? flag : bay;
        g.fillRect(L + i * bw + bw * 0.2, T + ph - h, bw * 0.6, h);
        g.fillStyle = ink; g.textAlign = 'center';
        g.fillText(x.label, L + i * bw + bw / 2, T + ph + 18);
      });
      if (spec.line) {
        const y = T + ph - spec.line.value / max * ph;
        g.strokeStyle = flag; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.setLineDash([]);
        g.fillStyle = flag; g.textAlign = 'right'; g.fillText(`${spec.line.label} ${spec.line.value}`, L + pw, y - 5);
      }
    } else {
      const pts = spec.points; const xs = pts.map((p) => Math.log10(p.x));
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      const ymax = niceMax(Math.max(...pts.map((p) => p.y)));
      axisY(g, L, T, pw, ph, 0, ymax, muted, rule, false);
      g.fillStyle = muted; g.textAlign = 'center';
      for (let d = Math.ceil(x0); d <= x1; d++) { const x = L + (d - x0) / (x1 - x0) * pw; g.fillText(String(Math.pow(10, d)) + ' m', x, T + ph + 18); g.strokeStyle = rule; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); }
      g.strokeStyle = bay; g.lineWidth = 2; g.beginPath();
      pts.forEach((p, i) => { const x = L + (Math.log10(p.x) - x0) / (x1 - x0) * pw, y = T + ph - p.y / ymax * ph; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke(); g.lineWidth = 1;
      if (spec.mark) { const x = L + (Math.log10(spec.mark) - x0) / (x1 - x0) * pw; g.strokeStyle = flag; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); g.setLineDash([]); g.fillStyle = flag; g.textAlign = 'left'; g.fillText('receptor used', x + 4, T + 12); }
    }
  }
  function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p; return 10 * p; }
  function axisY(g, L, T, pw, ph, lo, hi, muted, rule) {
    g.textAlign = 'right'; g.fillStyle = muted;
    for (let i = 0; i <= 4; i++) {
      const val = lo + (hi - lo) * i / 4, y = T + ph - ph * i / 4;
      g.strokeStyle = rule; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke();
      g.fillText(fmt(val, 2), L - 6, y + 4);
    }
  }

  // ---------- Boot ----------
  function fromHash() {
    const h = location.hash.slice(1); const [id, q] = h.split('?');
    const params = q ? Object.fromEntries(new URLSearchParams(q)) : null;
    go(id || 'combustion', params);
  }
  window.addEventListener('hashchange', fromHash);
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { const cv = $('#view canvas'); if (cv && lastChart) drawChart(cv, lastChart); }, 200); });
  fromHash();
})();

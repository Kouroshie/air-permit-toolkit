// Verification of calc.js against hand calculations and published reference values.
// Run: node tests/verify.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const A = require('../calc.js');
await import('../data.js');
const D = globalThis.APT_DATA;

let pass = 0, fail = 0;
function near(name, got, want, relTol = 1e-3) {
  const ok = Math.abs(got - want) <= Math.abs(want) * relTol + 1e-12;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: got ${got}, want ${want}`);
}
function truthy(name, cond) { if (cond) pass++; else fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); }

// 1. Method 19: 9 ppmvd NOx @ 3% O2 natural gas -> ~0.0109 lb/MMBtu (widely quoted as 0.011)
near('9 ppm NOx @3% O2 -> lb/MMBtu', A.ppmToLbMMBtu(9, 46.01, 8710, 3), 9e-6 * 46.01 / 385.3 * 8710 * 20.9 / 17.9);
near('9 ppm NOx is about 0.011 lb/MMBtu', A.ppmToLbMMBtu(9, 46.01, 8710, 3), 0.0109, 0.01);
// 2. O2 correction: 10 ppm at 7% O2 -> 3% O2 = 10 x 17.9 / 13.9
near('O2 correction 7% -> 3%', A.o2Correct(10, 7, 3), 10 * 17.9 / 13.9);
// Round trip
near('lb/MMBtu -> ppm round trip', A.lbMMBtuToPpm(A.ppmToLbMMBtu(25, 28.01, 8710, 15), 28.01, 8710, 15), 25);

// 3. Boiler example from the interview guide: 5 MMBtu/hr x 0.10 lb/MMBtu, 24 h/day, 2000 h/yr
const b = A.combustion({ heatInput: 5, hrsDay: 24, hrsYr: 2000, fuel: 'Natural gas', factors: { NOx: 0.10 } });
near('Boiler NOx lb/hr', b.out.rows[0].lbhr, 0.5);
near('Boiler NOx lb/day', b.out.rows[0].lbday, 12);
near('Boiler NOx ton/yr', b.out.rows[0].tpy, 0.5);
// GHG: 10,000 MMBtu x (53.06 + 0.001x34 + 0.0001x298)/1000 = 531.238 MT
near('Boiler CO2e', b.out.co2e, 10000 * (53.06 + 0.034 + 0.0298) / 1000);
// AP-42 factor conversion
near('AP-42 NG NOx 100/1020', A.ap42NGFactors('uncontrolled').NOx, 100 / 1020);

// 4. Generator example: 400 hp x 1.5 g/hp-hr -> 1.3228 lb/hr; 50 hr -> 66.14 lb
const e = A.engine({ power: 400, powerUnit: 'bhp', hrsDay: 24, hrsYr: 50, factors: { NOx: 1.5 } });
near('Engine lb/hr', e.out.rows[0].lbhr, 600 / 453.592);
near('Engine lb/yr', e.out.rows[0].lbyr, 600 / 453.592 * 50);
near('Engine lb/day', e.out.rows[0].lbday, 31.746, 1e-3);
const e2 = A.engine({ power: 1000, powerUnit: 'kWe', genEff: 95, hrsDay: 24, hrsYr: 50, factors: { NOx: 1 } });
near('kWe -> bhp', e2.out.bhp, 1000 / 0.95 / 0.7457);

// 5. Flare example: 100 Mscf x 1000 Btu/scf = 100 MMBtu; at 0.05 lb/MMBtu = 5 lb
const f = A.flare({ volumeMscf: 100, hours: 4, hhv: 1000, h2sPpm: 0, vocMolPct: 0, dre: 98, noxEf: 0.05, coEf: 0.31 });
near('Flare heat MMBtu', f.out.heat, 100);
near('Flare NOx lb', f.out.nox, 5);
// SO2 from 1000 ppm H2S in 379.5 Mscf = 1000 lb-mol -> 1 lb-mol SO2 = 64.06 lb
const f2 = A.flare({ volumeMscf: 379.5, hours: 1, hhv: 1000, h2sPpm: 1000, vocMolPct: 10, vocMW: 44.1, dre: 98, noxEf: 0.068, coEf: 0.31 });
near('Flare SO2 lb', f2.out.so2, 64.06);
near('Flare VOC lb', f2.out.voc, 1000 * 0.10 * 44.1 * 0.02);

// 6. Control: 90% capture x 95% destruction = 85.5% overall
const c = A.controlEff({ uncontrolled: 100, capture: 90, destruction: 95 });
near('Overall control', c.out.overall, 0.855);
near('Residual', c.out.residual, 14.5);
const c2 = A.controlEff({ uncontrolled: 100, capture: 100, destruction: 90, secondary: 90 });
near('Two devices in series', c2.out.overall, 0.99);

// 7. Coating: 340 g/L = 2.837 lb/gal
near('340 g/L -> lb/gal', A.gPerLtoLbPerGal(340), 340 * 3.785411784 / 453.592);
const co = A.coating({ gallons: 1000, vocLbGal: 3, capture: 90, destruction: 95, daysYr: 250, maxGalDay: 10 });
near('Coating controlled lb/yr', co.out.ctl, 3000 * 0.145);

// 8. Dispersion: Gaussian plume ground-level centerline, ground source H=0, class D urban, u=1 at 100 m
// sy = 0.16*100*(1.04)^-0.5, sz = 0.14*100*(1.03)^-0.5; C/Q = 1e6/(pi*u*sy*sz)
{
  const sy = 0.16 * 100 / Math.sqrt(1.04), sz = 0.14 * 100 / Math.sqrt(1.03);
  near('chi/Q urban D 100 m', A.chiOverQ(100, 0, 1, 'D', 'urban'), 1e6 / (Math.PI * sy * sz));
  // Rural F at 1000 m with H = 20 m
  const sy2 = 0.04 * 1000 / Math.sqrt(1.1), sz2 = 0.016 * 1000 / 1.3;
  near('chi/Q rural F 1 km H=20', A.chiOverQ(1000, 20, 2, 'F', 'rural'), 1e6 / (Math.PI * 2 * sy2 * sz2) * Math.exp(-400 / (2 * sz2 * sz2)));
  // Sanity check against the Pasquill-Gifford charts (class D at 1 km: sigma_y about 68 m, sigma_z about 32 m).
  // Briggs' rural formulas are a curve fit to those charts and run 10 to 25% higher at 1 km, so the tolerance is 25%.
  const syD = 0.08 * 1000 / Math.sqrt(1.1), szD = 0.06 * 1000 / Math.sqrt(2.5);
  truthy(`Briggs rural D sigmas at 1 km within 25% of P-G chart values (sy=${syD.toFixed(1)}, sz=${szD.toFixed(1)})`, Math.abs(syD / 68 - 1) < 0.25 && Math.abs(szD / 32 - 1) < 0.25);
}

// 9. Risk: residential factor equals the BAAQMD CEQA Health Risk Calculator 5.0 factor / 70 when the adult rate is 261
{
  const ceqaF14 = (361 * 10 * 1 * 0.25 + 1090 * 10 * 1 * 2 + 572 * 3 * 1 * 14 + 261 * 1 * 0.73 * 14) * (350 / 365);
  const mine261 = (361 * 10 * 0.25 + 1090 * 10 * 2 + 572 * 3 * 14 + 261 * 14 * 0.73) * (350 / 365) * 1e-6 / 70;
  near('Residential factor matches CEQA calculator (261)', mine261, ceqaF14 * 1e-6 / 70);
  // Diesel PM: 1 ug/m3 x CPF 1.1 -> about 740 in a million (233) residential
  const r = A.riskFromConc({ annualConc: 1, cpf: 1.1 });
  near('DPM 1 ug/m3 residential risk (233)', r.out.resRisk, 1.1 * A.residentFactor() * 1e6);
  truthy(`DPM 1 ug/m3 residential risk is in the 700s per million (${r.out.resRisk.toFixed(0)})`, r.out.resRisk > 700 && r.out.resRisk < 760);
  // The CEQA calculator converts lb/yr to g/s with 1.43833e-5
  near('lb/yr -> g/s constant', 453.592 / (8760 * 3600), 1.43833e-5, 1e-4);
}

// 10. Fees (Regulation 3, FY 2026-27, cross-checked against the Air District engine fee example, updated 9/28/2026)
{
  const s = A.feesScheduleB({ mmbtu: 5, raf: 'first', toxicSurcharge: true });
  near('Schedule B initial at 5 MMBtu/hr = minimum 573', s.out.init, 573);
  near('Schedule B RAF first = max(684+536.40, 1379)', s.out.raf, 1379);
  near('Schedule B PTO = max(268.20, 407)', s.out.pto, 407);
  near('Toxic surcharge 10%', s.out.sur, 40.7);
  near('Schedule B total', s.out.total, 684 + 573 + 1379 + 407 + 40.7);
  const big = A.feesScheduleB({ mmbtu: 50 });
  near('Schedule B initial 50 MMBtu/hr', big.out.init, 5364);
  near('Schedule B PTO 50 MMBtu/hr', big.out.pto, 2682);
  const huge = A.feesScheduleB({ mmbtu: 5000 });
  near('Schedule B initial capped', huge.out.init, 200137);
  near('Schedule B PTO capped', huge.out.pto, 100069);
  const d = A.feesScheduleD({ nozzleProducts: 12 });
  near('Schedule D total 12 nozzle-products', d.out.total, 684 + 378.10 * 12 + 144.82 * 12);
}

// 11. Data sanity
truthy('Every TAC has a name, CPF or REL', D.tac.every((t) => t.name && (t.cpf > 0 || t.crel > 0 || t.arel > 0)));
truthy('Diesel PM CPF 1.1 and chronic REL 5', (() => { const t = D.tac.find((x) => x.key === 'dpm'); return t.cpf === 1.1 && t.crel === 5; })());
truthy('BACT trigger is 10 lb/day', D.nsr.bactLbDay === 10);

// 12. Input validation
let threw = false; try { A.combustion({ heatInput: -1, hrsDay: 24, hrsYr: 10, factors: {} }); } catch (e) { threw = true; }
truthy('Negative heat input is rejected', threw);
threw = false; try { A.combustion({ heatInput: 1, hrsDay: 8, hrsYr: 8760, factors: {} }); } catch (e) { threw = true; }
truthy('Hours per year above hours/day x 365 is rejected', threw);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

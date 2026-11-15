# Air Permit Engineering Toolkit: methods and sources

Seyed Kourosh Mahjour, PhD. Version 1.1, November 15, 2026.

## 1. Purpose and scope

The toolkit reproduces the routine arithmetic of an air permit evaluation for stationary sources in the San Francisco Bay Area: emission rates, the Best Available Control Technology (BACT) and offset triggers of Regulation 2, Rule 2, the toxic air contaminant (TAC) screening of Regulation 2, Rule 5, and new-source fees under Regulation 3. Each calculator returns its result together with the ordered list of arithmetic steps, units and sources, so a reader can repeat the calculation by hand.

It is a screening and teaching tool. It does not replace dispersion modeling with AERMOD, risk calculation with HARP 2, or an engineer's application of the current rule text. It is an independent project and is not affiliated with or endorsed by the Bay Area Air District.

## 2. Existing Air District resources

A review of the Air District website (November 15, 2026) found these public calculation resources:

| Resource | Form | Coverage |
|---|---|---|
| Permit Handbook (revised October 30, 2024) | 316-page PDF | Calculation guidance by source category |
| Permit Handbook spreadsheets (for example `PH_00_05_02_01_emitcalc.xls`, boilers) | Separate Excel files | One source category each; one linked file (cooling towers) returned an HTML page instead of a workbook |
| BACT/TBACT Workbook | Web pages | Control technology determinations |
| Health Risk Calculator with Distance Multipliers, Beta 5.0 (posted May 3, 2022) | Excel | CEQA screening risk from facility emissions, fixed annual chi/Q of 360 ug/m3 per g/s |
| Stationary Source Screening Map (updated August 25, 2025) | ArcGIS | Screening risk by permitted facility |
| Example Engine Permit Fees (updated September 28, 2026) | PDF | Regulation 3 Schedule B fees for engines |

No single public tool links emission estimates, the NSR triggers, the Rule 2-5 screen and the fee schedules. The toolkit connects them and shows the intermediate values.

## 3. Unit conventions

| Quantity | Value | Source |
|---|---|---|
| Grams per pound | 453.592 | Definition (0.45359237 kg) |
| Molar volume, 68 F and 29.92 inHg | 385.3 scf/lb-mol | EPA Method 19 standard conditions |
| Molar volume, 60 F and 14.696 psia | 379.5 scf/lb-mol | Oil and gas reporting basis |
| Kilowatts per horsepower | 0.7457 | Definition |
| Molar volume at 25 C, 1 atm | 24.45 L/mol | Ambient conversion |
| Pounds per year to grams per second | 1.43833E-05 | 453.592 / (8,760 x 3,600) |

## 4. Emission calculations

### 4.1 Fuel combustion (boilers, heaters, turbines)

For pollutant i with emission factor EF_i (lb/MMBtu), maximum firing rate H (MMBtu/hr, higher heating value), maximum daily hours h_d and annual hours h_y:

- Hourly rate: E_hr = H x EF_i
- Maximum daily rate: E_day = E_hr x h_d
- Annual rate: E_yr = E_hr x h_y, and tons per year = E_yr / 2,000

The maximum daily value uses permitted capacity, because the BACT trigger is defined on the highest day (Section 5.1). An annual hours limit therefore lowers the annual value but not the daily value. The input check requires h_y to be no more than 365 h_d.

Default factors are AP-42 Section 1.4 (July 1998) values for small natural-gas boilers below 100 MMBtu/hr, converted from lb/10^6 scf with the 1,020 Btu/scf basis of the tables: NOx 100 (uncontrolled), CO 84, VOC 5.5, total PM 7.6 and SO2 0.6 lb/10^6 scf. Permit Handbook Chapter 2.1 notes that boilers of 10 MMBtu/hr or more are subject to BACT, so NOx and CO are normally taken from the BACT limit or the vendor guarantee rather than AP-42.

Greenhouse gases use 40 CFR Part 98 Subpart C: CO2 53.06 kg/MMBtu (Table C-1), CH4 1.0E-03 and N2O 1.0E-04 kg/MMBtu (Table C-2) for natural gas, and 73.96, 3.0E-03 and 6.0E-04 kg/MMBtu for distillate oil. CO2-equivalent uses the global warming potentials of Regulation 3 Schedule T (CH4 34, N2O 298):

CO2e (metric tons/yr) = H x h_y x (EF_CO2 + 34 EF_CH4 + 298 EF_N2O) / 1,000

### 4.2 Stack concentration to emission rate (EPA Method 19)

A concentration C (ppmvd) measured at oxygen content O2_m is corrected to reference oxygen O2_r:

C_r = C x (20.9 - O2_r) / (20.9 - O2_m)

and converted to an emission rate per heat input with the dry oxygen F-factor F_d (Equation 19-1):

E (lb/MMBtu) = C_r x 10^-6 x (MW / 385.3) x F_d x [20.9 / (20.9 - O2_r)] = C x 10^-6 x (MW / 385.3) x F_d x [20.9 / (20.9 - O2_m)]

The reference oxygen cancels, so the heat-input rate depends only on the measured concentration and the oxygen at which it was measured. The reference form is useful when starting from a permit or BACT limit already stated at O2_r. F_d = 8,710 dscf/MMBtu for natural gas and 9,190 dscf/MMBtu for fuel oil (Method 19, Table 19-2). For NOx expressed as NO2 (MW 46.01) from natural gas combustion, 9 ppmvd at 3% O2 gives 0.0109 lb/MMBtu. Permit Handbook Chapter 2.1 writes the same equation with 21 in place of 20.9.

### 4.3 Reciprocating engines

For an engine of brake power P (bhp) and certified factor EF (g/bhp-hr):

E_hr (lb/hr) = P x EF / 453.592

Electrical generator ratings are converted with P = kWe / (eta_gen x 0.7457), where eta_gen is generator efficiency (default 95%). Defaults are the EPA Tier 4 Final limits for generator sets above 900 kW in 40 CFR 1039.101, Table 1 (NOx 0.67, CO 3.5, NMHC 0.19 and PM 0.03 g/kW-hr). These standards are on a brake (shaft) basis, so they are converted to g/bhp-hr by multiplying by 0.7457 kW/bhp, without the generator efficiency: NOx 0.50, CO 2.61, NMHC 0.14 and PM 0.022 g/bhp-hr. Permit Handbook Chapter 2.3.1 directs reviewers to use CARB-certified factors first, then EPA-certified, then manufacturer data. Where only combined NMHC + NOx is certified, it assigns 95% to NOx and 5% to POC. All diesel particulate is treated as PM10 and PM2.5, and diesel PM is also the surrogate TAC for the Rule 2-5 screen.

Fuel heat input for the greenhouse gas estimate uses a brake-specific fuel consumption of 7,000 Btu/bhp-hr (AP-42 Section 3.3). The fee basis (Section 7) uses the same conversion. The state Airborne Toxic Control Measure for stationary diesel engines limits a new emergency engine to 50 hours per year of maintenance and testing (100 hours below 0.01 g/bhp-hr PM). Air District policy (June 3, 2019) adds 100 hours of emergency operation to potential to emit for applicability determinations, but not for the offset quantity or Rule 2-5. The toolkit computes one annual value from the hours the user enters; it does not keep two. To test offset applicability, enter maintenance and testing hours plus 100 (for example 150 hr/yr) and add that run to the project; for the Rule 2-5 screen, use maintenance and testing hours only.

### 4.4 Flares

For a gas volume V (scf at 60 F) with higher heating value HHV (Btu/scf):

- Heat released: Q = V x HHV / 10^6 (MMBtu)
- NOx and CO: Q x EF, with AP-42 Section 13.5 (February 2018) factors of 0.068 lb/MMBtu NOx (Table 13.5-1, elevated flares) and 0.31 lb/MMBtu CO (Table 13.5-2)
- Moles of gas: n (lb-mol) = V (scf) / 379.5 scf/lb-mol
- SO2 (lb), assuming complete oxidation of H2S: n x y_H2S x 64.06, where y_H2S is the H2S mole fraction (ppmv x 10^-6) and 64.06 lb/lb-mol is the molecular weight of SO2
- VOC sent to the flare (lb): n x y_VOC x MW_VOC, with y_VOC the VOC mole fraction and MW_VOC in lb/lb-mol; VOC emitted (lb): that amount x (1 - DRE), with DRE as a fraction

The AP-42 CO factor is published on a lower heating value basis and the NOx factor on a higher heating value basis. The toolkit applies both to the HHV-based heat release, which overstates CO by roughly the HHV/LHV ratio (about 1.1 for natural gas). The same volume arithmetic is used to check volumes reported for flaring and venting authorizations.

### 4.5 Coatings and solvents

VOC content in g/L (less water and exempt compounds) is converted to lb/gal by multiplying by 3.785411784 / 453.592. Annual VOC (lb/yr) = gallons (gal/yr) x VOC content (lb/gal) x (1 - eta_overall), where eta_overall = capture x control efficiency. The maximum daily value uses maximum daily material use. This mass balance follows Permit Handbook Chapter 5.1, which assumes all VOC in the material is emitted unless it is captured and destroyed.

### 4.6 Gasoline dispensing facilities

Total organic gas is estimated from throughput with the CARB (2013) factors for stations with enhanced vapor recovery, Table I-I, in lb per 1,000 gallons:

| Process | Factor |
|---|---|
| Phase I bulk transfer | 0.15 |
| Pressure-driven (breathing) losses | 0.024 |
| Refueling, vehicles without ORVR | 0.42 |
| Refueling, vehicles with ORVR | 0.021 |
| Spillage | 0.24 |
| Hose permeation (2017 value) | 0.009 |

The refueling factor is weighted by the share of gallons dispensed to vehicles with onboard refueling vapor recovery (f_ORVR, default 90%) and summed with the other factors:

EF_TOG = 0.15 + 0.024 + [0.021 x f_ORVR + 0.42 x (1 - f_ORVR)] + 0.24 + 0.009 lb/1,000 gal

The benzene fraction is a user input applied to total TOG (default 0.003 by weight). One fraction is applied to both vapor losses and liquid spillage, and only benzene is screened, not the other gasoline TACs (toluene, ethylbenzene, xylenes, naphthalene, n-hexane). Annual benzene is compared with the chronic trigger level. Peak-hour benzene is computed from a separate maximum hourly throughput input (default 1,000 gal/hr) and compared with the acute trigger level, because averaging annual throughput over 8,760 hours would understate the hourly peak. The Air District uses an internal spreadsheet based on CARB factors (Permit Handbook Chapter 3.2), and its CEQA page directs gas-station risk screening to the CARB Gas Station Risk Assessment Screening Tool, so results from this calculator are approximate.

### 4.7 Control efficiency

Overall control of a capture system and a control device, with an optional second device in series on the captured stream:

eta_overall = eta_capture x [1 - (1 - eta_control) x (1 - eta_2)]

The second device treats only what the capture system collects, so overall control can never exceed capture efficiency. With 90% capture and 95% control, 85.5% of the uncontrolled emissions are removed and 14.5% remain. Adding a 90% second device gives 0.90 x (1 - 0.05 x 0.10) = 89.55%, not 98.55%. A second stage that collects all remaining emissions independently is a different configuration and should be entered as its own capture and control pair.

## 5. New Source Review triggers (Regulation 2, Rule 2, amended December 6, 2017)

### 5.1 BACT

Section 2-2-301 requires BACT for a new source with a potential to emit of 10.0 pounds or more of a pollutant on any day (as defined in 2-1-217), and for a modified source that meets the same test and whose emissions increase above baseline (2-2-604). The toolkit compares the maximum daily value of each BACT pollutant (POC, NPOC, NOx, SO2, PM10, PM2.5 and CO) with 10.0 lb/day. Greenhouse gases and individual TACs are not compared with this threshold. It does not evaluate the baseline condition for modified sources.

### 5.2 Offsets

Facility potential to emit is the sum of the user-entered existing facility values and the sources added to the project, each at the annual value it was added with (see Section 4.3 for emergency engines).

- Section 2-2-302.1: NOx or POC above 10 and below 35 tons per year requires offsets at 1:1, normally from the Small Facility Banking Account.
- Section 2-2-302.2: NOx or POC of 35 tons per year or more requires federally enforceable offsets at 1.15:1 for the cumulative increase not yet offset since the baseline date, and reimbursement of the Small Facility Banking Account.
- Section 2-2-303: PM2.5, PM10 or SO2 of 100 tons per year or more requires offsets at 1:1 when the cumulative increase not yet offset exceeds 1 ton per year.

The toolkit flags the threshold only; for 2-2-303 it lists the 1 ton per year condition but does not evaluate it. The obligation itself depends on the cumulative increase since the baseline date, banked credits and exemptions, which the toolkit does not track.

## 6. Toxic air contaminant screening (Regulation 2, Rule 5, amended December 15, 2021)

### 6.1 Trigger levels

Each TAC is compared with its acute (lb/hr) and chronic (lb/yr) trigger level in Table 2-5-1. Exceeding either requires a health risk assessment. Cancer potency factors and chronic reference exposure levels are taken from the CP weighting and CREL weighting columns of the same table. These columns include multipathway exposure for arsenic, hexavalent chromium, lead, nickel and polycyclic aromatic hydrocarbons, and they are the values used in the Air District CEQA Health Risk Calculator 5.0.

| Contaminant | Acute trigger (lb/hr) | Chronic trigger (lb/yr) | CP weighting ((mg/kg-day)^-1) | CREL weighting (ug/m3) | Acute REL (ug/m3) |
|---|---|---|---|---|---|
| Diesel exhaust PM | none | 0.26 | 1.1 | 5.0 | none |
| Benzene | 0.012 | 2.9 | 0.10 | 3.0 | 27 |
| Formaldehyde | 0.024 | 14 | 0.021 | 9.0 | 55 |
| 1,3-Butadiene | 0.29 | 0.48 | 0.60 | 2.0 | 660 |
| Acrolein | 0.0011 | 14 | none | 0.35 | 2.5 |
| Hexavalent chromium | none | 0.00051 | 560 | 0.20 | none |
| Arsenic | 8.8E-05 | 0.0016 | 180 | 1.4E-04 | 0.20 |

The full list of 20 contaminants is in `data.js`.

### 6.2 Concentration at the receptor

The emission rate is converted to grams per second (lb/yr x 1.43833E-05, or lb/hr x 0.125998, that is 453.592 / 3,600). Two methods give the annual concentration:

1. **Air District screening value (default).** Annual chi/Q = 360 ug/m3 per g/s, the fixed value in the CEQA Health Risk Calculator 5.0.
2. **Gaussian plume for the stack.** The ground-level centerline concentration per unit emission is

   chi/Q = (10^6 / (pi u sigma_y sigma_z)) x exp(-H^2 / (2 sigma_z^2)) (ug/m3 per g/s)

   where u is the wind speed at stack height (m/s), sigma_y and sigma_z are the dispersion coefficients (m) at downwind distance x (m), and H = h_s + Delta h is the effective height (m). Stability class (A to F), wind speed and urban or rural setting are user inputs (defaults: class F, 1 m/s, urban, 3 m stack, plume rise off, T_a = 293 K; F stability with 1 m/s is the usual worst case for a short stack). The coefficients are the Briggs formulas for urban or rural conditions as tabulated by Turner (1994); for example, rural class D uses sigma_y = 0.08 x (1 + 0.0001 x)^-0.5 and sigma_z = 0.06 x (1 + 0.0015 x)^-0.5. Those fits are calibrated from about 100 m to 10 km, so values closer than 100 m are extrapolations. Distance is scanned on a log grid of 241 points from 10 m to 10 km, and the toolkit uses the larger of the value at the receptor distance and the maximum beyond it. The annual value is 0.1 times the 1-hour maximum, the annual scaling factor in EPA AERSCREEN guidance. The effective height H is the stack height, optionally increased by Briggs final buoyant plume rise: F = g v_s d^2 (T_s - T_a) / (4 T_s), with g = 9.807 m/s2, exit velocity v_s (m/s), inside diameter d (m), and stack and ambient temperatures T_s and T_a in kelvin (convert from F or C first). When T_s <= T_a, F is zero and no plume rise is applied (momentum rise is ignored, which is conservative). Otherwise, for classes A to D, Delta h = 21.425 F^0.75 / u for F < 55 m^4/s^3 and 38.71 F^0.6 / u otherwise. For stable classes E and F the stable formula Delta h = 2.6 (F / (u s))^(1/3) is used, with s = (g / T_a) x 0.020 for class E and 0.035 for class F (potential temperature gradients in K/m), capped at the neutral value.

The 1-hour concentration for the acute hazard index always comes from the plume calculation, using the stack and weather inputs on the form (their defaults apply if the user does not change them). Method 1 applies the 360 ug/m3 per g/s value without the distance multipliers in the Air District spreadsheet, so its result does not fall with receptor distance. Full Briggs final rise at every distance, and the lack of building downwash and transitional rise, can underpredict near-field concentrations for short stacks next to buildings; that is why Method 1 is the default.

### 6.3 Cancer risk and hazard indices

Residential inhalation cancer risk follows OEHHA (2015) for a 30-year exposure:

Risk = C x CPF x sum_k (DBR_k x ASF_k x ED_k x FAH_k) x EF x 10^-6 / AT

| Age group | DBR (L/kg-day) | ASF | ED (years) | FAH |
|---|---|---|---|---|
| Third trimester | 361 | 10 | 0.25 | 1.0 |
| 0 to 2 years | 1,090 | 10 | 2 | 1.0 |
| 2 to 16 years | 572 | 3 | 14 | 1.0 |
| 16 to 30 years | 261 | 1 | 14 | 0.73 |

EF = 350/365 and AT = 70 years. C is the annual concentration (ug/m3) and CPF the CP weighting value ((mg/kg-day)^-1); the 10^-6 converts ug to mg and L to m3. FAH = 1.0 below age 16 matches the CEQA calculator and the Rule 2-5 convention when a school is inside the 1-in-a-million zone. Without a school, OEHHA allows 0.85 (third trimester to age 2) and 0.72 (2 to 16), which lowers residential risk by about 16%, so the toolkit is conservative relative to a standard run. The first two breathing rates are 95th percentile values; the 2 to 16 rate is the 80th percentile. For ages 16 to 30 the toolkit uses 261 L/kg-day, the value in the Air District CEQA Health Risk Calculator 5.0, so its residential factor matches that calculator exactly. (OEHHA lists 233 L/kg-day as the 80th percentile for this group; the difference changes total risk by about 0.6%.) With these values, 1 ug/m3 of diesel PM gives a residential cancer risk of about 744 in a million.

Worker risk uses an 8-hour breathing rate of 230 L/kg-day:

Risk_worker = C x CPF x 230 x ASF 1 x 25 years x (250/365) x WAF x 10^-6 / 70

WAF = 1 assumes the source runs around the clock. For a source that runs only during the work shift, OEHHA sets WAF = (24 / source hours per day) x (7 / source days per week), which is 4.2 for 8 hours a day, 5 days a week; the toolkit does not apply that adjustment. Both residential and worker calculations use the multipathway CP weighting and CREL weighting values of Table 2-5-1, as the CEQA calculator does, so for arsenic, hexavalent chromium, lead, nickel and PAHs the result is a multipathway-weighted risk rather than inhalation alone. The chronic hazard index is the annual concentration divided by the chronic REL. The acute hazard index is the 1-hour concentration divided by the acute REL. Indices are summed across all contaminants without separating target organs, which can overstate the hazard index when several contaminants are present.

### 6.4 Decision thresholds

- Section 2-5-301: TBACT is required where source cancer risk exceeds 1.0 in a million or the chronic hazard index exceeds 0.20.
- Section 2-5-302: project limits are cancer risk of 10.0 in a million (6.0 in a million for a project in an Overburdened Community other than an Essential Public Service), and chronic and acute hazard indices of 1.0.

When the screening estimate exceeds a project limit, the toolkit says that a refined assessment is the next step. It does not say that the permit must be denied.

## 7. Permit fees (Regulation 3, effective July 1, 2026)

| Item | Amount |
|---|---|
| Filing fee (3-302) | $684 |
| Schedule B initial fee | $107.28 per MMBtu/hr; minimum $573, maximum $200,137 |
| Schedule B risk assessment fee, first TAC source | max($1,379, min($200,137, $684 + $107.28 per MMBtu/hr)); the $1,379 floor is the rule's stated minimum, not $684 + $573 |
| Schedule B risk assessment fee, each additional TAC source | $107.28 per MMBtu/hr; minimum $573, maximum $200,137 |
| Schedule B permit to operate fee | $53.64 per MMBtu/hr; minimum $407, maximum $100,069 |
| Toxic surcharge | 10% of the permit to operate fee |
| Solid-fuel surcharge (coke, coal, wood, tires, black liquor, municipal solid waste) | 100% of the initial and permit to operate fees |
| Schedule D, gasoline dispensing | $378.10 initial and $144.82 permit to operate per nozzle-product |
| Public notice (school within 1,000 ft, or HRA in an Overburdened Community) | Minimum invoice of $2,272, plus $1,000 for an HRA in an Overburdened Community |

These values were checked against the adopted rule (June 3, 2026), the May 2026 staff report and the Air District "Example Engine Permit Fees" sheet (updated September 28, 2026). Initial and permit to operate fees are clamped as max(minimum, min(maximum, rate x MMBtu/hr)). The risk assessment fee applies when a source needs a health risk assessment under 2-5-401 (acute or chronic trigger exceeded); the 10% toxic surcharge applies to sources that emit a TAC above a chronic trigger level. The user chooses which source is the first TAC source; Regulation 3 assigns that role to the source with the highest fee, and the order changes the total for small sources. The public notice amount is a minimum invoice for the notice, not a floor on the whole application fee. Schedule D risk assessment fees for gasoline stations are not computed. Flares are excluded from Schedule B and are charged flat fees under Schedules G-1 and G-5, and coating and solvent operations are billed under Schedule E; the toolkit computes neither. Small business (50%) and green business (10%) reductions under 3-302 are not applied.

## 8. Verification

`tests/verify.mjs` runs 48 checks in Node.js against hand calculations and published values, including:

- Method 19 conversion of 9 ppmvd NOx at 3% O2 for natural gas: 0.0109 lb/MMBtu
- Boiler at 5 MMBtu/hr and 0.10 lb/MMBtu: 0.50 lb/hr, 12 lb/day at 24 hours/day and 0.50 tons per year at 2,000 hours/year
- Engine of 400 bhp at 1.5 g/bhp-hr: 1.323 lb/hr
- Flare at 100 Mscf and 1,000 Btu/scf: 100 MMBtu; and 379.5 Mscf (thousand scf) with 1,000 ppmv H2S giving 64.06 lb SO2
- Overall control of 85.5% for 90% capture and 95% control, and 89.55% with a 90% second device on the captured stream
- A residential exposure factor equal to the factor in the Air District CEQA calculator when the same adult breathing rate is used
- Schedule B fee minimums, maximums and surcharges

The Briggs rural class D coefficients at 1 km (sigma_y 76 m, sigma_z 38 m) are within 25% of the Pasquill-Gifford chart values (about 68 m and 32 m). This is expected, because the Briggs formulas are a curve fit to those charts.

## 9. Limitations

- Rule thresholds and fees are fixed in `data.js` for the versions named above. Fees change every July.
- The dispersion screen ignores building downwash, transitional plume rise, terrain, meteorological data and multiple sources, and Method 1 omits the CEQA calculator's distance multipliers. It cannot replace AERMOD and HARP 2.
- Residential risk uses FAH = 1.0 below age 16 and worker risk uses WAF = 1, both conservative. Hazard indices are not separated by target organ.
- The flare CO factor (LHV basis) applied to HHV heat release overstates CO by about 10%, which can raise a BACT flag near 10 lb/day. Gasoline stations are screened for benzene only.
- The toolkit does not check source-specific prohibitory limits in Regulations 8 and 9 (for example Rule 9-7 for boilers and Rule 9-8 for engines), Schedule E fees, or the modified-source baseline test for BACT.
- The NSR module does not apply baseline emissions, banked credits, the Small Facility Banking Account balance, or federal PSD and major modification tests beyond listing the thresholds.
- Default emission factors are generic. A real evaluation uses certified, vendor or source-test data.

## References

- Bay Area Air Quality Management District (Bay Area Air District). Regulation 2, Rule 2, New Source Review (amended December 6, 2017).
- Bay Area Air District. Regulation 2, Rule 5, New Source Review of Toxic Air Contaminants, including Table 2-5-1 (amended December 15, 2021).
- Bay Area Air District. Regulation 3, Fees (amended June 3, 2026, effective July 1, 2026), and Staff Report (May 2026).
- Bay Area Air District. Permit Handbook (revised October 30, 2024).
- Bay Area Air District. Health Risk Calculator with Distance Multipliers, Beta 5.0 (May 3, 2022).
- California Air Resources Board (2013). Revised Emission Factors for Gasoline Marketing Operations at California Gasoline Dispensing Facilities.
- OEHHA (2015). Air Toxics Hot Spots Program Guidance Manual for Preparation of Health Risk Assessments.
- Turner, D. B. (1994). Workbook of Atmospheric Dispersion Estimates, 2nd ed. Lewis Publishers.
- US EPA (1995 onward). Compilation of Air Pollutant Emission Factors (AP-42), 5th ed., Vol. I: Section 1.4, Natural Gas Combustion (July 1998); Section 3.3, Gasoline and Diesel Industrial Engines (October 1996); Section 13.5, Industrial Flares (February 2018).
- US EPA. Method 19, Determination of Sulfur Dioxide Removal Efficiency and Particulate Matter, Sulfur Dioxide, and Nitrogen Oxide Emission Rates. 40 CFR Part 60, Appendix A-7.
- US EPA. Mandatory Greenhouse Gas Reporting, Subpart C, General Stationary Fuel Combustion Sources, Tables C-1 and C-2. 40 CFR Part 98.
- US EPA. Control of Emissions from New and In-Use Nonroad Compression-Ignition Engines, Exhaust emission standards (Tier 4). 40 CFR 1039.101.

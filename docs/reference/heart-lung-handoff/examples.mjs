import { VentilationSimulator } from './simulator.mjs';
import { writeFileSync } from 'node:fs';

function run(sim, seconds) {
  while (seconds > 60) { sim.step(60); seconds -= 60; }
  return sim.step(seconds);
}
const round = x => x === null ? null : Math.round(x * 10) / 10;
function record(label, sim) {
  const { respiratory:r, circulation:c, monitor:m } = sim.snapshot();
  return { label, timeS:round(sim.timeS), trueSaO2Percent:round(r.saO2*100),
    displayedSpo2Percent:round(m.spo2Percent), paO2mmHg:round(r.paO2mmHg),
    paCO2mmHg:round(r.paCO2mmHg), ph:Math.round(r.ph*100)/100,
    deliveredVtMl:round(r.deliveredVtMl), autoPeepCmH2O:round(r.autoPeepCmH2O),
    heartRateMin:round(c.heartRateMin), mapMmHg:round(c.mapMmHg),
    cardiacOutputLMin:round(c.cardiacOutputLMin), do2MlMin:round(c.do2MlMin),
    rhythm:c.rhythm };
}

const output = {
  notice:'SIMULATED OUTPUTS FROM AN UNVALIDATED EDUCATIONAL PROTOTYPE. All arrest timings are author-selected scenario behavior, not human reference ranges.',
  protocol:'Adult passive ventilation. Five minutes on baseline controls, then five minutes FiO2=1; disconnect without spontaneous breathing or apneic oxygenation. No treatment during deterioration.',
  desaturationExamples:[], asthmaRecovery:[], earlyHypoxiaRecovery:[], ardsPeepComparison:[],
};

for (const phenotype of ['healthy','obesity','ards']) {
  const sim = new VentilationSimulator({ phenotype });
  run(sim,300); sim.setVentilator({fio2:1}); run(sim,300);
  const baseline = record('before disconnection',sim);
  sim.setVentilator({mode:'OFF',connected:false});
  const times = { trueSaO2Below90S:null, displayedSpo2Below90S:null,
    bradycardiaS:null, peaS:null, asystoleS:null };
  for (let t = 1; t <= 1000; t++) {
    const z = sim.step(1);
    if (z.respiratory.saO2 < .9 && times.trueSaO2Below90S === null) times.trueSaO2Below90S = t;
    if (z.monitor.spo2Percent !== null && z.monitor.spo2Percent < 90 && times.displayedSpo2Below90S === null)
      times.displayedSpo2Below90S = t;
    if (z.circulation.rhythm === 'BRADYCARDIA' && times.bradycardiaS === null) times.bradycardiaS = t;
    if (z.circulation.rhythm === 'PEA' && times.peaS === null) times.peaS = t;
    if (z.circulation.rhythm === 'ASYSTOLE') { times.asystoleS = t; break; }
  }
  output.desaturationExamples.push({phenotype,baseline,timesAfterDisconnection:times});
}

{
  const sim = new VentilationSimulator({phenotype:'asthma'});
  run(sim,300);
  output.asthmaRecovery.push(record('baseline',sim));
  sim.setVentilator({rrMin:30,vtMl:700,inspiratoryTimeS:1});
  run(sim,60);
  output.asthmaRecovery.push(record('after 60 s of deliberately adverse settings',sim));
  // Example controls for regression/debrief, not a prescribed treatment recipe.
  sim.setVentilator({rrMin:8,vtMl:420,inspiratoryTimeS:0.7});
  for (const interval of [5,25,90]) {
    run(sim,interval);
    output.asthmaRecovery.push(record('during longer-expiration recovery',sim));
  }
}
{
  const sim = new VentilationSimulator();
  run(sim,300);
  sim.setVentilator({airwayOpen:false}); run(sim,90);
  output.earlyHypoxiaRecovery.push(record('90 s of complete obstruction',sim));
  sim.setVentilator({airwayOpen:true,fio2:1});
  for (const interval of [30,60,120]) {
    run(sim,interval);
    output.earlyHypoxiaRecovery.push(record('after restoring ventilation',sim));
  }
}
for (const peepCmH2O of [6,10,16,24]) {
  const sim = new VentilationSimulator({phenotype:'ards'});
  run(sim,300); sim.setVentilator({peepCmH2O}); run(sim,300);
  output.ardsPeepComparison.push(record(`PEEP ${peepCmH2O} after 5 min`,sim));
}

console.log(output.notice);
console.table(output.desaturationExamples.map(x=>({phenotype:x.phenotype,...x.timesAfterDisconnection})));
console.table(output.asthmaRecovery);
console.table(output.earlyHypoxiaRecovery);
console.table(output.ardsPeepComparison);
if (process.argv.includes('--write')) {
  writeFileSync(new URL('./reference-runs.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
}


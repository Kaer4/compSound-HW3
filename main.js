// Babbling Brook — WebAudio port of:
// {RHPF.ar(LPF.ar(BrownNoise.ar(), 400), LPF.ar(BrownNoise.ar(), 14) * 400 + 500, 0.03, 0.1)}.play

function makeBrownNoiseBuffer(audioCtx) {
    //slight edits to code for function
  const bufferSize = 10 * audioCtx.sampleRate;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);

  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    brown = Math.random() * 2 - 1;
    
    output[i] = (lastOut + 0.02 * brown) / 1.02;
    lastOut = output[i];
    output[i] *= 3.5;
  }
  return noiseBuffer;
}

function makeWhiteNoiseBuffer(audioCtx, seconds) {
  const bufferSize = (seconds || 4) * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function makeTanhWaveshaperCurve(n) {
  const N = n || 256;
  const curve = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = (i * 2) / (N - 1) - 1;
    curve[i] = Math.tanh(3 * x);  // for soft clipping
  }
  return curve;
}

// keep to control brook sound
var brookCtx = null;

function startBrook() {
  if (brookCtx) return;
  brookCtx = new AudioContext();

  // brown noise source 1 (audio)
  const noise1 = brookCtx.createBufferSource();
  noise1.buffer = makeBrownNoiseBuffer(brookCtx);
  noise1.loop = true;

  // brown noise source 2 (FM!)
  const noise2 = brookCtx.createBufferSource();
  noise2.buffer = makeBrownNoiseBuffer(brookCtx);
  noise2.loop = true;

  const lpf400 = brookCtx.createBiquadFilter();
  lpf400.type = 'lowpass';
  lpf400.frequency.value = 400;

  const lpf14 = brookCtx.createBiquadFilter();
  lpf14.type = 'lowpass';
  lpf14.frequency.value = 14;

  const rhpf = brookCtx.createBiquadFilter();
  rhpf.type = 'highpass';
  rhpf.frequency.value = 500;
  rhpf.Q.value = 1 / 0.03;

  const modGain = brookCtx.createGain();
  modGain.gain.value = 400;

 
  const masterGain = brookCtx.createGain();
  masterGain.gain.value = 0.1;

  noise1.connect(lpf400);
  lpf400.connect(rhpf);
  rhpf.connect(masterGain);
  masterGain.connect(brookCtx.destination);

  noise2.connect(lpf14);
  lpf14.connect(modGain);
  modGain.connect(rhpf.frequency);

  noise1.start();
  noise2.start();
}

function stopBrook() {
  if (!brookCtx) return;
  brookCtx.close();
  brookCtx = null;
}


//Jet Engine

//made up ratios for jet engine
var JET_TURBINE_RATIOS = [1, 1.52, 2.38, 3.21, 4.17];

var JET_TURBINE_AMPS = [1, 0.62, 0.42, 0.3, 0.2];


var jetState = null;


function clamp01(x) {
 if (x < 0) return 0;
 if (x > 1) return 1;
 return x;
}


function updateJetSpeed(speed) {
 if (!jetState) return;
 var s = clamp01(speed);
 jetState.currentSpeed = s;
 var ctx = jetState.ctx;
 var t = ctx.currentTime;
 var ramp = 0.04;


 var f0 = 78 + 420 * (s * s);
 for (var i = 0; i < 5; i++) {
   jetState.turbineOscs[i].frequency.setTargetAtTime(f0 * JET_TURBINE_RATIOS[i], t, ramp);
 }


 var turbineAudibility = 0.52 * (1 - s * s * s) + 0.06;
 jetState.turbineBus.gain.setTargetAtTime(turbineAudibility * 0.22, t, ramp);


 var noiseAudibility = 0.04 + 0.96 * Math.pow(s, 1.65);
 jetState.noiseBus.gain.setTargetAtTime(noiseAudibility * 0.55, t, ramp);


 var lp = 950 + 11800 * s * s;
 jetState.noiseLP.frequency.setTargetAtTime(lp, t, ramp);


 var hp = 80 + 120 * s; 
 jetState.noiseHP.frequency.setTargetAtTime(hp, t, ramp);


 var drive = 0.35 + 22 * (s * s);
 jetState.noiseDrive.gain.setTargetAtTime(drive, t, ramp);


 jetState.roarPeak.frequency.setTargetAtTime(380 + 5200 * s, t, ramp);
 jetState.roarPeak.Q.setTargetAtTime(0.4 + 2.2 * s, t, ramp);
 jetState.roarPeak.gain.setTargetAtTime(2 + 10 * s, t, ramp);
}


function startJetEngine() {
 if (jetState && jetState.ctx && jetState.ctx.state !== "closed") {
   return;
 }


 var AudioCtx = window.AudioContext || window.webkitAudioContext;
 var ctx = new AudioCtx();
 jetState = { ctx: ctx };


 ctx.resume();


 var master = ctx.createGain();
 master.gain.value = 0.85;


 var comp = ctx.createDynamicsCompressor();
 comp.threshold.value = -18;
 comp.knee.value = 18;
 comp.ratio.value = 3.2;
 comp.attack.value = 0.003;
 comp.release.value = 0.22;


 var distGain = ctx.createGain();
 distGain.gain.value = 1;
 var panner = ctx.createStereoPanner();
 master.connect(distGain);
 distGain.connect(panner);
 panner.connect(comp);
 comp.connect(ctx.destination);


 var turbineBus = ctx.createGain();
 turbineBus.gain.value = 0;
 turbineBus.connect(master);


 var turbineOscs = [];
 for (var ti = 0; ti < 5; ti++) {
   var o = ctx.createOscillator();
   o.type = "sine";
   o.frequency.value = 100 * JET_TURBINE_RATIOS[ti];
   var g = ctx.createGain();
   g.gain.value = JET_TURBINE_AMPS[ti] * 0.12;
   o.connect(g);
   g.connect(turbineBus);
   turbineOscs.push(o);
 }


 var noiseBuf = makeWhiteNoiseBuffer(ctx, 4);
 var noiseSrc = ctx.createBufferSource();
 noiseSrc.buffer = noiseBuf;
 noiseSrc.loop = true;


 var noiseBus = ctx.createGain();
 noiseBus.gain.value = 0;
 noiseBus.connect(master);


 var noiseLP = ctx.createBiquadFilter();
 noiseLP.type = "lowpass";
 noiseLP.Q.value = 0.7;


 var noiseHP = ctx.createBiquadFilter();
 noiseHP.type = "highpass";
 noiseHP.Q.value = 0.7;


 var noiseDrive = ctx.createGain();
 noiseDrive.gain.value = 1;


 var shaper = ctx.createWaveShaper();
 shaper.curve = makeTanhWaveshaperCurve();
 shaper.oversample = "4x";


 var roarPeak = ctx.createBiquadFilter();
 roarPeak.type = "peaking";


 noiseSrc.connect(noiseLP);
 noiseLP.connect(noiseDrive);
 noiseDrive.connect(shaper);
 shaper.connect(noiseHP);
 noiseHP.connect(roarPeak);
 roarPeak.connect(noiseBus);


 jetState.turbineOscs = turbineOscs;
 jetState.turbineBus = turbineBus;
 jetState.noiseSrc = noiseSrc;
 jetState.noiseBus = noiseBus;
 jetState.noiseLP = noiseLP;
 jetState.noiseHP = noiseHP;
 jetState.noiseDrive = noiseDrive;
 jetState.roarPeak = roarPeak;
 jetState.panner = panner;
 jetState.distGain = distGain;


 var speedSlider = document.getElementById("jetSpeed");
 var initial = speedSlider ? parseFloat(speedSlider.value) : 0.12;
 updateJetSpeed(initial);


 var t0 = ctx.currentTime;
 for (var j = 0; j < 5; j++) {
   turbineOscs[j].start(t0);
 }
 noiseSrc.start(t0);
}


function stopJetEngine() {
 if (!jetState || !jetState.ctx) return;
 flybyState = null;
 jetState.ctx.close();
 jetState = null;
}



// tried to make fly-by (Doppler + pan + distance attenuation) but it's not great... 

var flybyState = null;

function startFlyby() {
 if (!jetState) return;
 var alt = parseFloat(document.getElementById("flybyDist").value) || 300;
 flybyState = { altitude: alt, speed: 250, x: -(alt * 5), endX: alt * 5, lastTime: performance.now() };
 document.getElementById("flybyBtn").disabled = true;
 requestAnimationFrame(tickFlyby);
}

function tickFlyby() {
 if (!flybyState || !jetState) return;
 var now = performance.now();
 var dt = Math.min((now - flybyState.lastTime) / 1000, 0.05);
 flybyState.lastTime = now;
 flybyState.x += flybyState.speed * dt;
 var x = flybyState.x, h = flybyState.altitude;
 var d = Math.sqrt(x * x + h * h), c = 343;
 var v_toward = -flybyState.speed * x / d;
 var dopplerFactor = c / (c - v_toward);
 var pan = Math.max(-1, Math.min(1, x / (h * 1.5)));
 var gain = (h * h) / (d * d);
 var t = jetState.ctx.currentTime;
 jetState.panner.pan.setTargetAtTime(pan, t, 0.04);
 jetState.distGain.gain.setTargetAtTime(gain, t, 0.04);
 var s = jetState.currentSpeed || 0.12;
 var f0 = (78 + 420 * s * s) * dopplerFactor;
 for (var i = 0; i < 5; i++)
   jetState.turbineOscs[i].frequency.setTargetAtTime(f0 * JET_TURBINE_RATIOS[i], t, 0.02);
 jetState.noiseSrc.playbackRate.setTargetAtTime(dopplerFactor, t, 0.04);
 if (flybyState.x < flybyState.endX) {
   requestAnimationFrame(tickFlyby);
 } else {
   jetState.panner.pan.setTargetAtTime(0, t, 0.4);
   jetState.distGain.gain.setTargetAtTime(1, t, 0.4);
   jetState.noiseSrc.playbackRate.setTargetAtTime(1, t, 0.4);
   updateJetSpeed(jetState.currentSpeed);
   flybyState = null;
   document.getElementById("flybyBtn").disabled = false;
 }
}


document.getElementById("start").addEventListener("click", function onStart() {
 startBrook();
 document.getElementById("start").disabled = true;
 document.getElementById("stopBrook").disabled = false;
});


document.getElementById("stopBrook").addEventListener("click", function onStopBrook() {
 stopBrook();
 document.getElementById("start").disabled = false;
 document.getElementById("stopBrook").disabled = true;
});


document.getElementById("startJet").addEventListener("click", function onStartJet() {
 startJetEngine();
 document.getElementById("startJet").disabled = true;
 document.getElementById("stopJet").disabled = false;
 document.getElementById("jetSpeed").disabled = false;
 document.getElementById("flybyBtn").disabled = false;
 document.getElementById("flybyDist").disabled = false;
});


document.getElementById("stopJet").addEventListener("click", function onStopJet() {
 stopJetEngine();
 document.getElementById("startJet").disabled = false;
 document.getElementById("stopJet").disabled = true;
 document.getElementById("jetSpeed").disabled = true;
 document.getElementById("flybyBtn").disabled = true;
 document.getElementById("flybyDist").disabled = true;
});


document.getElementById("jetSpeed").addEventListener("input", function () {
 updateJetSpeed(parseFloat(this.value));
});


document.getElementById("flybyBtn").addEventListener("click", startFlyby);



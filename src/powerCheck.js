export const volumePowerCheck = (rec, fs, preSec, Sec, _calibrateSoundPowerBinDesiredSec) => {
    const coarseHz = 1 / _calibrateSoundPowerBinDesiredSec;
    const power = rec.map(x => Math.pow(x, 2)); // Squared values of the signal
    
    // Adjust coarseHz so that fs is an integer multiple of coarseHz.
    let n = Math.round(fs / coarseHz);
    
    // Sampling times for plotting
    const t = Array.from({ length: power.length }, (_, i) => i / fs);
    
    const coarseSamples = Math.ceil(power.length / n);
    const coarsePowerDb = new Array(coarseSamples).fill(0);
    const coarseT = new Array(coarseSamples).fill(0);

    for (let i = 0; i < coarseSamples; i++) {
        const indices = Array.from({ length: Math.min(n, power.length - i * n) }, (_, idx) => i * n + idx);
        const extremeIndices = [indices[0], indices[indices.length - 1]];
        
        const avgPower = indices.reduce((sum, idx) => sum + power[idx], 0) / indices.length;
        coarsePowerDb[i] = 10 * Math.log10(avgPower);
        
        const avgTime = (t[extremeIndices[0]] + t[extremeIndices[1]]) / 2;
        coarseT[i] = avgTime;
    }

    const prepSamples = Math.round(coarseHz * preSec);
    const postSamples = Math.round(coarseHz * (preSec + Sec));
    const sd = Math.round(standardDeviation(coarsePowerDb.slice(prepSamples)) * 10) / 10;
    
    const coarseTRounded = coarseT.map(t => Math.round(t * 1000) / 1000); // Round to 3 decimal places
    const coarsePowerDbRounded = coarsePowerDb.map(db => Math.round(db * 1000) / 1000); // Round to 3 decimal places

    const start = interpolate(coarseT, coarsePowerDb, preSec);
    const end = interpolate(coarseT, coarsePowerDb, preSec + Sec);
    
    let preT = coarseTRounded.slice(0, prepSamples);
    let preDb = coarsePowerDbRounded.slice(0, prepSamples);
    
    // Adjust starting point of preT and preDb
    if (preT[preT.length - 1] < preSec) {
        preT.push(preSec);
        preDb.push(start);
    }

    let recT = coarseTRounded.slice(prepSamples, postSamples);
    let recDb = coarsePowerDbRounded.slice(prepSamples, postSamples);
    
    if (recT[0] > preSec) {
        recT.unshift(preSec);
        recDb.unshift(start);
    }
    
    if (recT[recT.length - 1] < preSec + Sec) {
        recT.push(preSec + Sec);
        recDb.push(end);
    }

    let postT = coarseTRounded.slice(postSamples);
    let postDb = coarsePowerDbRounded.slice(postSamples);

    if (postT[0] > preSec + Sec) {
        postT.unshift(preSec + Sec);
        postDb.unshift(end);
    }

    return { preT, preDb, recT, recDb, postT, postDb, sd };
}

// Helper function for interpolation
export const interpolate = (x, y, target) => {
    let lowIdx = 0;
    while (lowIdx < x.length - 1 && x[lowIdx] < target) {
        lowIdx++;
    }

    const x0 = x[lowIdx - 1];
    const y0 = y[lowIdx - 1];
    const x1 = x[lowIdx];
    const y1 = y[lowIdx];

    // Linear interpolation
    return y0 + ((target - x0) * (y1 - y0)) / (x1 - x0);
}

// Helper function to calculate standard deviation
export const standardDeviation = (arr) => {
    const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length;
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
}

export const getPower = (dataArray) => {
    const squaredValues = dataArray.map(value => value * value);
      const sum_of_squares = squaredValues.reduce((total, value) => total + value, 0);
      const squared_mean = sum_of_squares / dataArray.length;
      const dbLevel = 20 * Math.log10(Math.sqrt(squared_mean));
      const roundedDbLevel = Math.round(dbLevel * 10) / 10;
      return roundedDbLevel;
}
const ndarray = require('ndarray')
const ndfft = require('ndarray-fft')

function compareInt (a, b) {
  return a - b
}

module.exports = function (options) {
  //
  // basic inputs
  //
  // regl instance
  const regl = options.regl
  // web audio analyser node
  const analyser = options.analyser
  // sample rate in Hz
  const sampleRate = options.sampleRate || 44100

  //
  // beat detection
  //
  // number of beat detection bins (set to 0 to disable)
  const binCount = 'beats' in options ? options.beats : 16
  // length of moving window in seconds
  const beatTime = options.beatTime || 1.0
  // strictness of beat detection (should be between 0.5 and 1)
  const beatThreshold = options.beatThreshold || 0.8

  //
  // pitch detection
  //
  // number of pitches to detect (set to 0 to disable)
  const pitchCount = 'pitches' in options ? options.pitches : 4
  // minimum detectable pitch in Hz
  const maxPitch = (options.minPitch || 5000)
  // length of moving pitch window in seconds
  const pitchTime = (options.pitchTime || 0.25)

  // -------------------------------------------
  // implementation stuff
  // -------------------------------------------
  const N = analyser.frequencyBinCount

  const freq = new Uint8Array(N)
  const time = new Uint8Array(N)
  const cepstrum = new Float64Array(N)

  const freqTexture = regl.texture({
    shape: [N, 1, 1],
    type: 'uint8'
  })

  const timeTexture = regl.texture({
    shape: [N, 1, 1],
    type: 'uint8'
  })

  const uniforms = {
    sampleCount: N,
    freq: freqTexture,
    time: timeTexture,
    volume: regl.prop('volume')
  }

  for (let i = 0; i < binCount; ++i) {
    uniforms['beats[' + i + ']'] = regl.prop('beats[' + i + ']')
  }

  for (let i = 0; i < pitchCount; ++i) {
    uniforms['pitches[' + i + ']'] = regl.prop('pitches[' + i + ']')
  }

  const setupAnalysis = regl({
    context: {
      sampleCount: N,
      freq,
      time,
      cepstrum: cepstrum,
      freqTexture,
      timeTexture,
      volume: regl.prop('volume'),
      beats: regl.prop('beats'),
      pitches: regl.prop('pitches')
    },
    uniforms
  })

  const binSize = Math.floor(N / binCount) | 0
  const beatBufferSize = Math.ceil(beatTime * sampleRate / N) | 0

  const volumeHistory = new Float64Array(binCount * beatBufferSize)
  const beats = Array(binCount).fill(0)

  const medianArray = Array(beatBufferSize).fill(0)
  const cutoffIndex = Math.floor((beatBufferSize - 1) * beatThreshold) | 0

  let beatPtr = 0
  let volume = 0
  function estimateBeats () {
    let vol = 0.0
    for (var i = 0; i < binCount; ++i) {
      for (let j = i * beatBufferSize, k = 0; k < beatBufferSize; ++j, ++k) {
        medianArray[k] = volumeHistory[j]
      }
      medianArray.sort(compareInt)

      let sum = 0.0
      for (let j = binSize * i; j < binSize * (i + 1); ++j) {
        const x = Math.pow(freq[j] / 255.0, 2.0)
        sum += x
        vol += x
      }
      sum = Math.sqrt(sum) / binSize
      beats[i] = sum > medianArray[cutoffIndex] ? sum : 0
      volumeHistory[beatPtr + beatBufferSize * i] = sum
    }
    volume = Math.sqrt(volume) / N
    beatPtr = (beatPtr + 1) % beatBufferSize
  }

  const imagFreq = new Float64Array(N)
  const ndrcepstrum = ndarray(cepstrum)
  const ndicepstrum = ndarray(imagFreq)

  const startQ = Math.min(Math.ceil(sampleRate / maxPitch), N / 2) | 0
  const endQ = (N / 2) | 0

  const pitches = Array(pitchCount).fill(0)

  const pitchWindow = Math.ceil(pitchTime * sampleRate / N) | 0
  const pitchHistogram = new Float64Array(N)
  const pitchHistory = new Float64Array(pitchWindow * pitchCount)
  let pitchWindowPtr = 0

  const pitchIndex = Array(N).fill(0).map(function (_, i) {
    return i
  })
  function comparePitch (a, b) {
    return pitchHistogram[b] - pitchHistogram[a]
  }

  const pitchQ = Array(pitchCount).fill(0)
  const pitchW = Array(pitchCount).fill(0)

  function estimatePitch () {
    for (let i = 0; i < N; i += 2) {
      cepstrum[N - 1 - i] = cepstrum[i] = Math.log(1 + freq[i])
    }
    for (let i = 0; i < N; ++i) {
      imagFreq[i] = 0
    }

    // TODO: use deema's fourier module here instead
    ndfft(-1, ndrcepstrum, ndicepstrum)

    for (let i = 0; i < pitchCount; ++i) {
      pitchQ[i] = 0
      pitchW[i] = -Infinity
    }

    for (let i = startQ; i < endQ; ++i) {
      const a = cepstrum[i - 1]
      const b = cepstrum[i]
      const c = cepstrum[i + 1]

      if (b > a && b > c) {
        for (let j = 0; j < pitchCount; ++j) {
          if (pitchW[j] < b) {
            for (let k = pitchCount - 1; k > j; --k) {
              pitchQ[k] = pitchQ[k - 1]
              pitchW[k] = pitchW[k - 1]
            }
            pitchQ[j] = i
            pitchW[j] = b
            break
          }
        }
      }
    }

    // Update histogram
    for (let j = 0; j < pitchCount; ++j) {
      const w = 1.0 / (1.0 + j)
      if (pitchQ[j]) {
        pitchHistogram[pitchQ[j]] += w
      }
      var prev = pitchHistory[pitchWindowPtr]
      if (prev) {
        pitchHistogram[prev] -= w
      }
      pitchHistory[pitchWindowPtr] = pitchQ[j]
      pitchWindowPtr = (pitchWindowPtr + 1) % pitchHistory.length
    }

    // Take top k pitch values for current pitch
    // FIXME: should use heap or insertion sort here
    pitchIndex.sort(comparePitch)

    for (let j = 0; j < pitchCount; ++j) {
      if (pitchIndex[j]) {
        pitches[j] = sampleRate / pitchIndex[j]
      } else {
        for (; j < pitchCount; ++j) {
          pitches[j] = 0
        }
      }
    }
  }

  return function (block) {
    // poll analyser
    analyser.getByteFrequencyData(freq)
    analyser.getByteTimeDomainData(time)

    // upload texture data
    freqTexture.subimage(freq)
    timeTexture.subimage(time)

    // update beat detection
    if (binCount) {
      estimateBeats()
    }

    // update pitch detection
    if (pitchCount) {
      estimatePitch()
    }

    setupAnalysis({
      volume,
      beats,
      pitches
    },
    block)
  }
}

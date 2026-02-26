# How Sonance Detects Pitch

This document explains the pitch detection pipeline in Sonance, from raw microphone input to tuning feedback, and the theory behind the YIN algorithm that makes it work.

## Overview

Sonance captures audio from the device microphone, extracts a windowed buffer of samples, runs the YIN pitch detection algorithm to estimate the fundamental frequency, and maps the result to the nearest standard guitar tuning note.

```
Microphone -> AudioContext -> AnalyserNode -> Float32Array -> YIN -> Hz -> Note + Cents
```

## 1. Capturing Audio

The browser's Web Audio API provides the entire audio pipeline.

**getUserMedia** requests microphone access and returns a `MediaStream`. This stream is connected to an `AudioContext`, which is the entry point to the Web Audio processing graph.

```
MediaStream -> MediaStreamAudioSourceNode -> AnalyserNode
```

The `AnalyserNode` is configured with `fftSize = 4096`. This determines the number of samples in each analysis window. A larger window gives better frequency resolution at lower pitches -- critical for guitar, where the lowest string (E2) vibrates at only 82.41 Hz.

At a sample rate of 44100 Hz, a 4096-sample window covers about 93ms of audio, which contains roughly 7-8 full cycles of E2. The algorithm needs multiple cycles to reliably detect periodicity.

## 2. Extracting Samples

Each animation frame (~60 times per second), the app calls `analyserNode.getFloatTimeDomainData(buffer)`. This fills a `Float32Array` with the most recent 4096 time-domain samples, where each value is a floating-point number between -1.0 and 1.0 representing the instantaneous amplitude.

This raw waveform is what the YIN algorithm analyzes.

## 3. The YIN Algorithm

YIN is a fundamental frequency estimator published by Alain de Cheveigne and Hideki Kawahara in 2002. It is a time-domain method, meaning it works directly on the waveform rather than converting to the frequency domain via FFT.

The core insight: a periodic signal, when compared against a time-shifted copy of itself, will show minimum difference at lags equal to the period (and its multiples). YIN formalizes this idea through six steps.

> **Reference**: De Cheveigne, A., & Kawahara, H. (2002). "YIN, a fundamental frequency estimator for speech and music." *The Journal of the Acoustical Society of America*, 111(4), 1917-1930. [DOI: 10.1121/1.1458024](https://doi.org/10.1121/1.1458024)

### Step 1: Autocorrelation

The starting point is the classical autocorrelation method. For a discrete signal x, the autocorrelation at lag tau measures how similar the signal is to a shifted version of itself:

```
r(tau) = SUM(x[j] * x[j + tau])
```

Peaks in the autocorrelation correspond to candidate periods. The problem: the highest peak is always at tau = 0 (the signal compared to itself), and the method is prone to octave errors -- picking a peak at half or double the true period.

### Step 2: Difference Function

Instead of measuring similarity, YIN measures *difference*. The difference function computes the squared difference between the signal and a lagged copy:

```
d(tau) = SUM((x[j] - x[j + tau])^2)
```

When the lag equals the true period, the signal and its shifted copy align, and `d(tau)` reaches a minimum (ideally zero for a perfectly periodic signal). This is mathematically related to autocorrelation:

```
d(tau) = r(0) + r_shifted(0) - 2 * r(tau)
```

The difference function still has the zero-lag problem: `d(0) = 0` is always the global minimum.

### Step 3: Cumulative Mean Normalized Difference Function (CMNDF)

This is the key innovation in YIN. The difference function is normalized by its running cumulative mean:

```
d'(tau) = 1,                                   if tau = 0
d'(tau) = d(tau) / ((1/tau) * SUM(d[j])),      if tau > 0
```

where the sum runs from j = 1 to tau.

This accomplishes two things:
- **Eliminates the zero-lag dip**: `d'(0)` is defined as 1, preventing the algorithm from falsely selecting zero lag
- **Enables absolute thresholding**: the normalized values are scale-independent, so a single threshold works across different signal amplitudes

The first valley in `d'(tau)` that dips below the threshold is selected as the period candidate.

### Step 4: Absolute Threshold

A threshold (typically 0.1 to 0.15) is applied to `d'(tau)`. The algorithm searches for the smallest tau where `d'(tau) < threshold`. If multiple valleys fall below the threshold, the first one is chosen -- this biases toward the true fundamental and away from subharmonics (which appear at multiples of the period).

If no valley falls below the threshold, the global minimum is selected instead.

### Step 5: Parabolic Interpolation

The period estimate from Step 4 is integer-valued (in samples). Parabolic interpolation refines it to sub-sample precision by fitting a parabola through three points: `d'(tau - 1)`, `d'(tau)`, and `d'(tau + 1)`. The vertex of this parabola gives a fractional tau estimate.

This matters for accuracy. At 44100 Hz sample rate, the difference between tau = 100 and tau = 101 corresponds to 441 Hz vs 436.6 Hz -- a gap of 4.4 Hz. Parabolic interpolation fills in the gaps.

### Step 6: Best Local Estimate

The final step guards against the "octave problem." When the signal is not perfectly periodic (which is always the case with real instruments), peaks at multiples of the true period can sometimes score better than the fundamental. Step 6 compares the initially selected valley against nearby candidates and picks the one with the lowest `d'(tau)` value within a local neighborhood.

### Why YIN for Guitar?

- **Frequency range**: guitar standard tuning spans 82-330 Hz, a range where YIN excels
- **Time-domain**: no FFT overhead, fast enough for real-time use in the browser
- **Low octave error rate**: the CMNDF normalization and threshold strategy significantly reduce octave misdetection
- **Low latency**: results are available per analysis window (~93ms at fftSize 4096)

## 4. Frequency to Note Mapping

Once YIN returns a frequency (e.g., 112.3 Hz), Sonance maps it to the nearest standard tuning note using the **cents** scale.

### The Cents Scale

Musical pitch perception is logarithmic. The interval between two frequencies is measured in cents, where 1200 cents equals one octave:

```
cents = 1200 * log2(detected / reference)
```

This means each semitone is 100 cents, regardless of absolute frequency. The same formula works whether you're comparing 82 Hz to 82.41 Hz or 330 Hz to 329.63 Hz.

### Finding the Closest Note

For each of the six reference frequencies, the app computes the absolute cents distance from the detected frequency. The note with the smallest distance wins:

| String | Note | Reference (Hz) |
| ------ | ---- | -------------- |
| 6th    | E2   | 82.41          |
| 5th    | A2   | 110.00         |
| 4th    | D3   | 146.83         |
| 3rd    | G3   | 196.00         |
| 2nd    | B3   | 246.94         |
| 1st    | E4   | 329.63         |

### Tuning Feedback

The sign and magnitude of the cents offset determine the feedback:

| Cents Offset | Status  |
| ------------ | ------- |
| -5 to +5     | In tune |
| -15 to -5    | Slightly flat (yellow) |
| +5 to +15    | Slightly sharp (yellow) |
| Beyond +/-15 | Off (red) |

### Frequency Guard

Detected frequencies outside 60-400 Hz are discarded. This filters out noise, breath sounds, and harmonics that fall outside the guitar's standard tuning range.

## 5. The Real-Time Loop

The detection runs in a `requestAnimationFrame` loop, which fires roughly 60 times per second. Each iteration:

1. Reads the latest 4096 samples from the `AnalyserNode`
2. Passes them to the YIN detector
3. Maps the result to a note and cents offset
4. Updates the React state, which re-renders the tuning display

Because `AnalyserNode` maintains a sliding window of the most recent samples (not discrete non-overlapping blocks), consecutive reads overlap significantly. This provides smooth, continuous feedback rather than discrete jumps.

## References

- De Cheveigne, A., & Kawahara, H. (2002). "YIN, a fundamental frequency estimator for speech and music." *The Journal of the Acoustical Society of America*, 111(4), 1917-1930. [DOI: 10.1121/1.1458024](https://doi.org/10.1121/1.1458024)
- [pitchfinder](https://github.com/peterkhayes/pitchfinder) -- JavaScript implementation of YIN and other pitch detection algorithms
- [ABSounds/YIN-Pitch](https://github.com/ABSounds/YIN-Pitch) -- Python reference implementation with visualizations
- [Web Audio API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

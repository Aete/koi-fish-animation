export const RippleParams = {
  // Wave
  speed: 2,             // expansion speed (px/frame)
  amplitude: 8,         // distortion intensity (px)
  waveWidth: 50,        // wave width (px)
  maxRadiusMin: 100,    // minimum max radius (px)
  maxRadiusMax: 150,    // maximum max radius (px)

  // Visual
  ringCount: 4,         // number of concentric rings
  ringGap: 30,          // ring spacing (px)
  lineWidth: 8,         // stroke width
  strokeColor: '#465d46', // ring stroke color (greenish black - ink wash)
  strokeAlpha: 0.055,     // stroke opacity
  fillColor: '#868d86',   // ring fill color (muted green-gray)
  fillAlpha: 0,           // fill opacity

  // Scatter
  scatterStrength: 6.5, // scatter force intensity
  scatterWindow: 0.35,  // scatter active range (0~1)
  distanceFactor: 10,   // distance-speed proportionality (higher = closer fish flee faster)
};

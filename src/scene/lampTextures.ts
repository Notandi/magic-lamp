import * as THREE from 'three';

/**
 * A CPU-backed 2D canvas. These textures take thousands of strokes, which can crash
 * the browser's GPU process on a GPU-backed canvas.
 */
function canvas(width: number, height: number) {
  const el = document.createElement('canvas');
  el.width = width;
  el.height = height;
  return { el, g: el.getContext('2d', { willReadFrequently: true })! };
}

/**
 * The Lamp's engraving, as a height map: mid-grey is the surface, darker is cut in,
 * lighter is raised. x runs along the Lamp (tail to spout), y runs around it
 * (0 = underside, 0.5 = top). Fish scales cover the top; a vine frieze runs along each flank.
 */
export function engravingTexture(): THREE.CanvasTexture {
  const W = 2048;
  const H = 1024;
  const { el, g } = canvas(W, H);
  const surface = '#808080';
  const cut = '#2a2a2a';
  const raised = '#d8d8d8';
  g.fillStyle = surface;
  g.fillRect(0, 0, W, H);

  g.strokeStyle = cut;
  g.lineWidth = 3;
  const scaleWidth = 34;
  const scaleHeight = 26;
  for (let row = 0, y = H * 0.335; y < H * 0.665; y += scaleHeight, row++) {
    for (let x = ((row % 2) * scaleWidth) / 2 - scaleWidth; x < W + scaleWidth; x += scaleWidth) {
      g.beginPath();
      g.arc(x, y, scaleWidth / 2, 0, Math.PI);
      g.stroke();
    }
  }

  for (const centre of [H * 0.25, H * 0.75]) {
    const half = 46;
    g.fillStyle = surface;
    g.fillRect(0, centre - half - 14, W, 2 * half + 28);
    for (const side of [-1, 1]) {
      g.strokeStyle = raised;
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(0, centre + side * (half + 4));
      g.lineTo(W, centre + side * (half + 4));
      g.stroke();
      g.strokeStyle = cut;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(0, centre + side * (half - 6));
      g.lineTo(W, centre + side * (half - 6));
      g.stroke();
    }
    // Two vines weaving through each other.
    const periods = 40;
    const k = (Math.PI * 2 * periods) / W;
    for (const phase of [0, Math.PI]) {
      g.strokeStyle = cut;
      g.lineWidth = 5;
      g.beginPath();
      for (let x = 0; x <= W; x += 3) g.lineTo(x, centre + Math.sin(x * k + phase) * (half - 18));
      g.stroke();
    }
    // A raised bead in every eye of the vine, a cut leaf either side of every crossing.
    for (let i = 0; i < periods * 2; i++) {
      g.fillStyle = raised;
      g.beginPath();
      g.arc(((i + 0.5) * Math.PI) / k, centre, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = cut;
      for (const side of [-1, 1]) {
        g.beginPath();
        g.ellipse((i * Math.PI) / k, centre + side * 30, 4, 9, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  const texture = new THREE.CanvasTexture(el);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** Uneven polish, so highlights break up the way they do on old metal. Used as a roughness map. */
export function patinaTexture(): THREE.CanvasTexture {
  const S = 512;
  const { el, g } = canvas(S, S);
  g.fillStyle = 'rgb(150,150,150)';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    const v = Math.floor(90 + Math.random() * 150);
    g.fillStyle = `rgba(${v},${v},${v},${0.04 + Math.random() * 0.1})`;
    g.beginPath();
    g.ellipse(
      Math.random() * S,
      Math.random() * S,
      4 + Math.random() * 46,
      3 + Math.random() * 18,
      Math.random() * Math.PI,
      0,
      Math.PI * 2,
    );
    g.fill();
  }
  const texture = new THREE.CanvasTexture(el);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

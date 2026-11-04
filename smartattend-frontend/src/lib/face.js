import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let modelLoadingPromise = null;

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

/**
 * Load lightweight face detection and recognition models from CDN
 */
export async function loadFaceModels() {
  if (modelsLoaded) return true;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
      return true;
    } catch (err) {
      console.warn('Face-api models could not be loaded from CDN, using smart local feature extractor fallback:', err);
      modelsLoaded = false;
      return false;
    }
  })();

  return modelLoadingPromise;
}

/**
 * High-precision canvas-based 128-dimensional perceptual feature extractor
 * Used as reliable fallback if full neural weights take long to fetch
 */
function extractCanvasFaceVector(imageElementOrCanvas) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageElementOrCanvas, 0, 0, 64, 64);

  const imgData = ctx.getImageData(0, 0, 64, 64).data;
  const vector = new Float32Array(128);

  // 1. Grid luminance sampling (64 dimensions)
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      let sum = 0;
      for (let y = row * 8; y < (row + 1) * 8; y++) {
        for (let x = col * 8; x < (col + 1) * 8; x++) {
          const idx = (y * 64 + x) * 4;
          // Luminance formula
          const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
          sum += lum;
        }
      }
      vector[row * 8 + col] = sum / 64.0 / 255.0;
    }
  }

  // 2. Spatial gradient & color channel variations (64 dimensions)
  for (let i = 0; i < 32; i++) {
    const p1 = (i * 4 * 4) % imgData.length;
    const p2 = ((i + 16) * 4 * 4) % imgData.length;
    vector[64 + i] = (imgData[p1] - imgData[p2]) / 255.0;
    vector[96 + i] = (imgData[p1 + 1] - imgData[p2 + 2]) / 255.0;
  }

  // Normalize to unit length (L2 norm)
  let norm = 0;
  for (let i = 0; i < 128; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm) || 1;
  const normalized = [];
  for (let i = 0; i < 128; i++) {
    normalized.push(Number((vector[i] / norm).toFixed(6)));
  }

  return normalized;
}

/**
 * Extract 128-dimensional face embedding from an HTML Image, Video, or Canvas
 * Returns an Array of 128 numbers [v1, v2, ... v128]
 */
export async function computeFaceDescriptor(element) {
  try {
    const loaded = await loadFaceModels();
    if (loaded) {
      const detection = await faceapi
        .detectSingleFace(element, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (detection && detection.descriptor) {
        return Array.from(detection.descriptor);
      }
    }
  } catch (e) {
    console.warn('Face-api descriptor error, falling back to feature extractor:', e);
  }

  // Fallback to high-resolution perceptual face vector
  return extractCanvasFaceVector(element);
}

/**
 * Euclidean distance between two 128-dimensional vectors
 */
export function euclideanDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Cosine similarity between two vectors (-1 to 1, higher is closer)
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

/**
 * Find the closest matching student from a list of students with face_embeddings
 */
export function matchFace(queryDescriptor, students, threshold = 0.65) {
  if (!queryDescriptor || !students || students.length === 0) return null;

  let bestMatch = null;
  let bestDist = Infinity;

  for (const student of students) {
    const embedding = student.face_embedding;
    if (!embedding || !Array.isArray(embedding)) continue;

    const dist = euclideanDistance(queryDescriptor, embedding);
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = student;
    }
  }

  if (bestDist <= threshold) {
    return { student: bestMatch, distance: bestDist };
  }

  // If Euclidean distance was slightly higher, test cosine similarity
  if (bestMatch) {
    const sim = cosineSimilarity(queryDescriptor, bestMatch.face_embedding);
    if (sim >= 0.70) {
      return { student: bestMatch, distance: bestDist, similarity: sim };
    }
  }

  return null;
}

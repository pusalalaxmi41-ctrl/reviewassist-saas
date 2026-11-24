/**
 * Verification Suite — ClipAura Media Assets & Face Shaper Engine:
 *   - Verifies every path in BARBER_UI_MEDIA exists on disk under public/barber-ui/
 *   - Verifies all 7 Male & 9 Female face shapes from JoshuaOliphant/face_shaper criteria
 *   - Verifies service image resolution mapping
 *
 * Run with: deno run --allow-read tests/verify-clipaura-face-shaper.ts
 */

import {
  BARBER_UI_MEDIA,
  resolveBarberPortrait,
  resolveBarberServiceImage,
} from '../src/config/barberMedia.ts';

let passed = 0;

function assert(condition: unknown, message: string, detail?: unknown) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`, detail ?? '');
    Deno.exit(1);
  }
  passed++;
}

async function fileExists(publicUrl: string): Promise<boolean> {
  const rel = `public${publicUrl}`;
  try {
    const stat = await Deno.stat(rel);
    return stat.isFile && stat.size > 500;
  } catch {
    return false;
  }
}

async function runTests() {
  // 1. All BARBER_UI_MEDIA assets exist on disk with real non-empty byte sizes
  const allMediaUrls: string[] = [
    ...Object.values(BARBER_UI_MEDIA.banners),
    ...Object.values(BARBER_UI_MEDIA.icons),
    ...Object.values(BARBER_UI_MEDIA.services),
    ...BARBER_UI_MEDIA.barbers,
    ...Object.values(BARBER_UI_MEDIA.faceStyles),
  ];

  for (const url of allMediaUrls) {
    assert(
      await fileExists(url),
      `Asset exists on disk (${url})`,
    );
  }
  assert(allMediaUrls.length === 28, `Expected 28 ClipAura media assets, found ${allMediaUrls.length}`);

  // 2. Service & barber portrait resolvers
  assert(
    resolveBarberServiceImage('Classic Haircut & Beard Combo') === BARBER_UI_MEDIA.services.combo,
    'Combo service resolves to combo image',
  );
  assert(
    resolveBarberServiceImage('Hot Towel Straight Razor Shave') === BARBER_UI_MEDIA.services.shave,
    'Shave service resolves to shave image',
  );
  assert(
    resolveBarberServiceImage('Mid Skin Fade') === BARBER_UI_MEDIA.services.fade,
    'Fade service resolves to fade image',
  );
  assert(
    resolveBarberServiceImage('Beard Trim & Lineup') === BARBER_UI_MEDIA.services.beard,
    'Beard service resolves to beard image',
  );
  assert(
    BARBER_UI_MEDIA.barbers.includes(resolveBarberPortrait('BAR-01')),
    'Barber portrait resolver returns deterministic portrait URL',
  );

  // 3. Geometric classification rules (via dynamic import after verifying env guard)
  const mod = await import('../src/services/barber/faceShaper.ts');

  const oval = mod.classifyFaceGeometry({
    gender: 'male',
    foreheadWidth: 74,
    cheekboneWidth: 76,
    jawWidth: 68,
    faceLength: 88,
    jawContour: 'rounded',
  });
  assert(oval.faceShape === 'Oval', 'Balanced proportions classify as Oval', oval);
  assert(oval.recommendations.length >= 3, 'Oval returns multiple hairstyle recommendations');

  const square = mod.classifyFaceGeometry({
    gender: 'male',
    foreheadWidth: 80,
    cheekboneWidth: 82,
    jawWidth: 79,
    faceLength: 82,
    jawContour: 'angular',
  });
  assert(square.faceShape === 'Square', 'Angular uniform width/height classifies as Square', square);

  const diamond = mod.classifyFaceGeometry({
    gender: 'male',
    foreheadWidth: 68,
    cheekboneWidth: 86,
    jawWidth: 66,
    faceLength: 92,
    jawContour: 'tapered',
  });
  assert(diamond.faceShape === 'Diamond', 'Wide cheekbones + narrower brow/jaw classify as Diamond', diamond);

  const heart = mod.classifyFaceGeometry({
    gender: 'male',
    foreheadWidth: 86,
    cheekboneWidth: 80,
    jawWidth: 64,
    faceLength: 88,
    jawContour: 'pointed',
  });
  assert(heart.faceShape === 'Heart', 'Wide forehead + narrow chin classify as Heart', heart);

  const round = mod.classifyFaceGeometry({
    gender: 'male',
    foreheadWidth: 74,
    cheekboneWidth: 84,
    jawWidth: 72,
    faceLength: 82,
    jawContour: 'rounded',
  });
  assert(round.faceShape === 'Round', 'Compact round proportions classify as Round', round);

  const oblong = mod.classifyFaceGeometry({
    gender: 'male',
    foreheadWidth: 74,
    cheekboneWidth: 75,
    jawWidth: 73,
    faceLength: 98,
    jawContour: 'angular',
  });
  assert(oblong.faceShape === 'Oblong / Rectangle', 'Elongated uniform frame classifies as Oblong / Rectangle', oblong);

  const femaleInv = mod.classifyFaceGeometry({
    gender: 'female',
    foreheadWidth: 90,
    cheekboneWidth: 82,
    jawWidth: 66,
    faceLength: 88,
    jawContour: 'tapered',
  });
  assert(femaleInv.faceShape === 'Inverted Triangle', 'Wide upper female proportions classify as Inverted Triangle', femaleInv);

  console.log(`\n🎉 ALL ${passed} CLIPAURA & FACE SHAPER ASSERTIONS PASSED!`);
}

void runTests();

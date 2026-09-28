/* ── Frames data ────────────────────────────────────────────────────────────
   The single list of every photo in the five galleries. destination.html
   builds each gallery from it and index.html's Vectorscope reads all of it,
   so add, remove or reorder a photo HERE and both pages follow.

   Each photo: file (inside public/destinations/<slug>/), w / h (the real
   pixel size — the galleries reserve the space before the image lands), alt
   (what is in the frame). The order within a place IS the gallery's layout
   order — see the note on each list before moving anything.

   Two derived variants live beside each original, both made with Pillow
   (see CLAUDE.md › Vectorscope for the generator):
     m/<base>.jpg  — long edge 1400px, what phones and tablets load
     t/<base>.jpg  — long edge 320px, the Vectorscope's contact sheet and
                     the pixels it samples for the trace                  */
window.FRAMES = (function () {
  var BASE = 'public/destinations/';

  // public/destinations/<place>/<name>.<ext> → public/destinations/<place>/<kind>/<name>.jpg
  function variant(src, kind) {
    var cut = src.lastIndexOf('/');
    return src.slice(0, cut) + '/' + kind + '/' + src.slice(cut + 1).replace(/\.[^.]+$/, '') + '.jpg';
  }

  function place(slug, title, caption, photos) {
    return {
      slug: slug,
      title: title,
      caption: caption,
      photos: photos.map(function (p) {
        var src = BASE + slug + '/' + p.file;
        return { src: src, lite: variant(src, 'm'), thumb: variant(src, 't'), w: p.w, h: p.h, alt: p.alt };
      })
    };
  }

  var spain = place('spain', 'MALLORCA & IBIZA',
    'One week of beach hopping, too much Ibérico ham, and trying to recreate the Limitless edit.', [
    { file: 'yacht-flag-girl-crop.jpg',   w: 1692, h: 1560, alt: 'Girl on a yacht with an American flag' }, // hand-cropped
    { file: 'jump.jpg',                   w: 2880, h: 2160, alt: 'Overhead cliff jump into a turquoise cove' },
    { file: 'Timeline 1_01_00_04_08.jpg', w: 3840, h: 2160, alt: 'Pines above a boat on the water' },
    { file: 'Timeline 1_01_00_06_11.jpg', w: 3840, h: 2160, alt: 'Woman holding a phone on the boat' },
    { file: 'cover.jpg',                  w: 3840, h: 2160, alt: 'Beach cove between cliffs, umbrellas on the sand' },
    { file: 'goat.png',                   w: 1916, h: 1514, alt: 'A goat on the rocks' },
    { file: 'Timeline 1_01_00_08_10.jpg', w: 3840, h: 2160, alt: 'Alongside a yacht' },
    { file: 'Timeline 1_01_00_23_13.jpg', w: 3840, h: 2160, alt: 'Paddleboarding in the cove' },
    { file: 'beach.jpg',                  w: 3840, h: 2160, alt: 'Cove harbour with swimmers' },
    { file: 'Timeline 1_01_00_25_21.jpg', w: 3840, h: 2160, alt: 'Cliff coastline, girl on the bow' },
    { file: 'Timeline 1_01_00_10_21.jpg', w: 3840, h: 2160, alt: 'Church' },
    { file: 'Timeline 1_01_00_32_15.jpg', w: 3840, h: 2160, alt: 'Cliff jump into the cove' },
    { file: 'Timeline 1_01_00_41_13.jpg', w: 3840, h: 2160, alt: 'Boarding at the marina' },
    { file: 'Timeline 1_01_00_14_09.jpg', w: 3840, h: 2160, alt: 'Town and trams' },
    { file: 'Timeline 1_01_00_03_11.jpg', w: 3840, h: 2160, alt: 'Cove overview' },
    { file: 'jump-shot-crop.jpg',         w: 2256, h: 1550, alt: 'Jumping off the boat' }, // hand-cropped
    { file: 'Timeline 1_01_00_49_16.jpg', w: 3840, h: 2160, alt: 'Tram and people' },
    { file: 'replacement.jpg',            w: 2880, h: 2160, alt: 'Jet skis' }, // full uncropped image
    { file: 'Timeline 1_01_00_17_02.jpg', w: 3840, h: 2160, alt: 'Lemons' },
    { file: 'Timeline 1_01_01_29_09.jpg', w: 3840, h: 2160, alt: 'Sunbathers' }
  ]);

  // Spain-style mix: an aligned 3:2 top row, then wides / squares / 3:2s
  // interleaved so every column gets one of each shape (the middle rows
  // mismatch on purpose while the column totals stay equal), closing on an
  // aligned 4:3 night row with a flush bottom. The shape rotation starts at
  // the very top: every row (the first included) mixes a 3:2, a wide and a
  // square, but each column still collects one of each shape.
  var japan = place('japan', 'Tokyo, Osaka, & Kamakura',
    'Some of the best scenery in the world. Temples, Shibuya Crossing, small beach towns, and 7-Eleven iced vanilla lattes.', [
    { file: 'green-32.jpg',    w: 3240, h: 2160, alt: 'Greenery framing a temple roof' },
    // kamakura's w is 3241 on purpose: the hair-thinner ratio wins the greedy
    // tie against green, keeping it in the middle column (its real file is
    // 3240×2160 — the 0.03% difference is sub-pixel)
    { file: 'kamakura-32.jpg', w: 3241, h: 2160, alt: 'Train window with an ocean view' },
    { file: 'couple-crop.jpg', w: 2160, h: 2160, alt: 'Kamakura street, a couple under an umbrella' },
    { file: 'family1.jpg',     w: 3178, h: 2066, alt: 'Couple making a heart on the beach' },
    { file: 'shrine-sq.jpg',   w: 2160, h: 2160, alt: 'Shrine steps on a sunny day' },
    { file: 'bells-wide.jpg',  w: 3322, h: 2160, alt: 'Wind chimes at the shrine' },
    { file: 'bird-sq.jpg',     w: 2160, h: 2160, alt: 'Three doves by the pond' },
    { file: 'gate-32.jpg',     w: 3240, h: 2160, alt: 'Railway crossing by the ocean' },
    { file: 'van-crop.jpg',    w: 3322, h: 2160, alt: 'Kei van by the ocean' },
    { file: 'stanley-32.jpg',  w: 3240, h: 2160, alt: 'Shibuya at night, neon portrait' },
    { file: 'tram-32.jpg',     w: 3240, h: 2160, alt: 'Enoden tram on the hillside' },
    { file: 'waves-32.jpg',    w: 2400, h: 1600, alt: 'Overhead, arms out in the waves' },
    // last row — aligned 4:3 night finale: Osaka and Tokyo after dark
    { file: 'dotonbori-43.jpg', w: 2880, h: 2160, alt: 'Dotonbori busker under the lanterns' },
    { file: 'shibuya-43.jpg',   w: 2880, h: 2160, alt: 'Shibuya crossing crowd' },
    { file: 'glico-crop.jpg',   w: 2880, h: 2160, alt: 'Glico sign, Osaka' }
  ]);

  // Four shapes (16:9 / square / 3:2 / 4:3), one of each per column, rotating
  // from the very first row — no row shares one ratio, yet the columns stay
  // equal and the bottoms flush.
  var italy = place('italy', 'The Dolomites',
    'Grad trip through the Dolomites. Five days, five hostels, one thunderstorm, and some of the most beautiful views I’ve ever seen. Unforgettable trip.', [
    { file: 'peaks.jpg',        w: 3840, h: 2160, alt: 'Arms out before the jagged peaks' },
    { file: 'overlook-sq.jpg',  w: 1080, h: 1080, alt: 'Seated before the ridge panorama' },
    { file: 'hotel-32.jpg',     w: 1620, h: 1080, alt: 'Alpine hotel beneath the massif' },
    { file: 'horses-43.jpg',    w: 2082, h: 1561, alt: 'Two horses galloping in the meadow' },
    { file: 'friends-43.jpg',   w: 2090, h: 1568, alt: 'Four packs, arms around shoulders' },
    { file: 'family.jpg',       w: 3840, h: 2160, alt: 'Hikers with poles in the meadow' },
    { file: 'dandelion-sq.jpg', w: 1080, h: 1080, alt: 'Dandelion blow at dusk' },
    { file: 'scree-sq.jpg',     w: 1080, h: 1080, alt: 'Crossing the white scree basin' },
    { file: 'trail-32.jpg',     w: 1620, h: 1080, alt: 'Climbing the grassy switchback' },
    { file: 'cards-43.jpg',     w: 1440, h: 1080, alt: 'Card game on the terrace' },
    { file: 'rest-32.jpg',      w: 1620, h: 1080, alt: 'Break beside the trail under the big peak' },
    { file: 'bridge.jpg',       w: 3840, h: 2160, alt: 'Village bridge with flower boxes' }
  ]);

  // Same recipe as Japan: every column collects two 3:2s, one wide, one square
  // and one 4:3 night shot — rows mismatch from the top, columns end flush, and
  // the fireworks close the page.
  var vancouver = place('vancouver', 'Vancouver',
    'The best city in the world. Beaches, great food, great people, and the only place I can drive a car.', [
    { file: 'rings-32.jpg',     w: 3240, h: 2160, alt: 'Olympic rings on the Whistler slope' },
    { file: 'baker-32.jpg',     w: 2223, h: 1482, alt: 'Mt. Baker over the valley, from the road' }, // bottom trimmed to the grass line
    { file: 'goggles-sq.jpg',   w: 2160, h: 2160, alt: 'Goggles on the ski jacket, slope mirrored' },
    { file: 'jump-wide.jpg',    w: 3322, h: 2160, alt: 'Four friends mid-leap into the lake' },
    { file: 'dive-sq.jpg',      w: 1558, h: 1558, alt: 'The dive and the splash' }, // from the hand-cropped jump.png
    { file: 'village-wide.jpg', w: 3322, h: 2160, alt: 'Whistler village crowd' },
    { file: 'sparkpair-sq.jpg', w: 2160, h: 2160, alt: 'Twin bursts over English Bay' },
    { file: 'chairwalk-32.jpg', w: 3240, h: 2160, alt: 'Walking the ridge, board on back' },
    { file: 'gondola-wide.jpg', w: 3322, h: 2160, alt: 'Gondola laughs, boards racked' },
    { file: 'carwave-32.jpg',   w: 3240, h: 2160, alt: 'Wave out the car window' },
    { file: 'dock-32.jpg',      w: 3240, h: 2160, alt: 'Dock afternoon on the lake' },
    { file: 'skislope-32.jpg',  w: 3240, h: 2160, alt: 'Red jacket carving under the chairlift' },
    // aligned 4:3 night finale — fireworks over the city
    { file: 'fw-city-43.jpg',   w: 2880, h: 2160, alt: 'Pink fireworks over the skyline' },
    { file: 'fw-orange-43.jpg', w: 2880, h: 2160, alt: 'Amber burst, the water glowing' },
    { file: 'fw-gold-43.jpg',   w: 2880, h: 2160, alt: 'Green-gold pair from the beach' }
  ]);

  // Italy's four-shape rotation (16:9 / square / 3:2 / 4:3, one of each per
  // column): rows mismatch from the top, columns end flush. The arc runs dawn
  // to dusk — balloons open, the golden-hour trio (chairs, pool, riders) closes.
  var morocco = place('morocco', 'Marrakech',
    'Missed the trip, but not the footage. Frames shot by my friend Brent, color graded by me.', [
    { file: 'balloons.jpg',    w: 2560, h: 1440, alt: 'Hot-air balloons over the fields at dawn' }, // 1.5× zoom
    { file: 'cat-sq.jpg',      w: 2160, h: 2160, alt: 'Boardwalk cat on patrol' },
    { file: 'rooftops-32.jpg', w: 3240, h: 2160, alt: 'Medina rooftops at dusk' },
    { file: 'market-43.jpg',   w: 2880, h: 2160, alt: 'Market crew, night portrait' },
    { file: 'couple-43.jpg',   w: 2880, h: 2160, alt: 'Two at the shoreline, pastel sea' },
    { file: 'shoplaugh.jpg',   w: 3840, h: 2160, alt: 'The shop laugh' },
    { file: 'dog-sq.jpg',      w: 2160, h: 2160, alt: 'The brown dog says hello' },
    { file: 'captain-sq.jpg',  w: 2160, h: 2160, alt: 'Captain through the blue rigging' },
    { file: 'atv-32.jpg',      w: 3240, h: 2160, alt: 'Quad run across the flats' },
    { file: 'chairs-43.jpg',   w: 2880, h: 2160, alt: 'Two chairs facing the Atlantic' },
    { file: 'pool-32.jpg',     w: 3240, h: 2160, alt: 'Pool gathering at sunset' },
    { file: 'riders.jpg',      w: 3840, h: 2160, alt: 'Horse riders silhouetted on the dusk beach' }
  ]);

  return {
    // insertion order = destination.html's order; the homepage picks its own
    places: { spain: spain, japan: japan, italy: italy, vancouver: vancouver, morocco: morocco },
    variant: variant
  };
})();

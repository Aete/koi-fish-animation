// port of Daniel Shiffman's Inverse Kinematics coding challenge
// by madacoo

let tentacle;


function setup() {
  createCanvas(600, 400);

  // We set up point as a p5.Vector instead of passing Segment an x and a y
  // because JavaScript does not have function overloading.
  // See segment.js for more information.
  let point = new p5.Vector(300, 200);

  let current = new Segment(point, 10, 0);
  for (let i = 0; i < 20; i++) {
    let next = new Segment(current, 10, i);
    current.child = next;
    current = next;
  }
  tentacle = current;
}


function draw() {
  background(51);

  // Update all segments
  tentacle.follow(mouseX, mouseY);
  tentacle.update();

  let next = tentacle.par;
  while (next) {
    next.follow();
    next.update();
    next = next.par;
  }

  // Draw the fish
  drawFish();
}

function drawFish() {
  // Get all segment positions
  let segments = tentacle.getAllSegments();

  // Draw fish body with gradient
  for (let i = 0; i < segments.length - 1; i++) {
    let t = i / segments.length;

    // Gradient color from head (red) to tail (orange/yellow)
    let r = lerp(255, 255, t);
    let g = lerp(100, 200, t);
    let b = lerp(100, 50, t);

    // Width tapers from head to tail
    let thickness = lerp(30, 5, t);

    stroke(r, g, b);
    strokeWeight(thickness);
    strokeCap(ROUND);

    let seg = segments[i];
    line(seg.a.x, seg.a.y, seg.b.x, seg.b.y);
  }

  // Draw fish head (triangle pointing forward)
  let head = segments[segments.length - 1];
  let angle = head.angle;

  push();
  translate(head.a.x, head.a.y);
  rotate(angle);

  fill(255, 80, 80);
  noStroke();

  // Head triangle
  triangle(20, 0, -15, -15, -15, 15);

  // Eye
  fill(255);
  ellipse(5, -5, 8, 8);
  fill(0);
  ellipse(5, -5, 4, 4);

  pop();

  // Draw tail fin
  let tail = segments[0];
  let tailAngle = tail.angle;

  push();
  translate(tail.b.x, tail.b.y);
  rotate(tailAngle);

  fill(255, 150, 100, 200);
  noStroke();

  // Tail fin
  triangle(0, 0, -20, -15, -20, 15);

  pop();

  // Draw dorsal fin (on top)
  if (segments.length > 10) {
    let dorsalSeg = segments[Math.floor(segments.length * 0.6)];
    let dorsalAngle = dorsalSeg.angle;

    push();
    translate(dorsalSeg.a.x, dorsalSeg.a.y);
    rotate(dorsalAngle - HALF_PI);

    fill(255, 120, 120, 200);
    noStroke();
    triangle(0, 0, -10, 15, 10, 15);

    pop();
  }

  // Draw pectoral fin (side fin)
  if (segments.length > 5) {
    let pectoralSeg = segments[Math.floor(segments.length * 0.75)];
    let pectoralAngle = pectoralSeg.angle;

    push();
    translate(pectoralSeg.a.x, pectoralSeg.a.y);
    rotate(pectoralAngle + HALF_PI);

    fill(255, 120, 120, 150);
    noStroke();
    ellipse(0, 10, 12, 20);

    pop();
  }
}



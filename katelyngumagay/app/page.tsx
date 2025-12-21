"use client";

import { useEffect, useRef } from "react";

/* =======================
   DATA
======================= */

const PANELS = [
  "The dreamer",
  "The designer",
  "The producer",
  "The developer",
  "The content creator",
];

const BUFFER_COUNT = 3;

/* =======================
   LAYOUT CONSTANTS
======================= */

const PANEL_WIDTH = 280;
const GAP = 30;
const FULL = PANEL_WIDTH + GAP;

/* =======================
   DERIVED PANELS
======================= */

const leftBuffer = PANELS.slice(-BUFFER_COUNT);
const rightBuffer = PANELS.slice(0, BUFFER_COUNT);
const RENDERED_PANELS = [...leftBuffer, ...PANELS, ...rightBuffer];

export default function Home() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    /* =======================
       DIMENSIONS
    ======================= */
    const realCount = PANELS.length;
    const realWidth = realCount * FULL;
    const bufferWidth = BUFFER_COUNT * FULL;
    const viewportWidth = viewport.clientWidth;

    /* =======================
       STATE
    ======================= */
    let position = bufferWidth;
    let isDragging = false;
    let startX = 0;
    let lastX = 0;

    const applyTransform = () => {
      track.style.transform = `translateX(${-position}px)`;
    };

    applyTransform();

    /* =======================
       LOOP CORRECTION
    ======================= */
    const TELEPORT_MARGIN = viewportWidth / 2;
    const correctLoop = () => {
      // too far left — jump forward without animation
      if (position < bufferWidth - TELEPORT_MARGIN) {
        track.style.transition = "none"; // disable animation
        position += realWidth;
        applyTransform();
        // force reflow to make sure next animation works
        track.getBoundingClientRect();
        track.style.transition = "transform 0.3s ease";
      }

      // too far right — jump backward without animation
      else if (position > bufferWidth + realWidth - TELEPORT_MARGIN) {
        track.style.transition = "none"; // disable animation
        position -= realWidth;
        applyTransform();
        track.getBoundingClientRect();
        track.style.transition = "transform 0.3s ease";
      }
    };


    /* =======================
       SNAP TO CENTER
    ======================= */
    const snapToClosest = () => {
      track.style.transition = "transform 0.3s ease";

      // Get current viewport width dynamically
      const currentViewportWidth = viewport.clientWidth;

      // Bias for easier left swipes
      const SNAP_BIAS = 0.5 * FULL;

      // Compute center based on current width
      const center = position + currentViewportWidth / 2 - bufferWidth - SNAP_BIAS;

      const index = Math.round(center / FULL);

      position = bufferWidth + index * FULL - currentViewportWidth / 2 + FULL / 2 - GAP / 2;
      applyTransform();

      setTimeout(() => {
        track.style.transition = "none";
      }, 300);
    };



    /* =======================
       WHEEL SCROLL
    ======================= */

    const wrapPosition = () => {
      const totalWidth = PANELS.length * FULL;
      if (position < 0) position += totalWidth;
      else if (position > totalWidth) position -= totalWidth;
    };

    let wheelVelocity = 0;
    let wheelTimeout: NodeJS.Timeout | null = null;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Trackpad friendly
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 20;
      if (e.deltaMode === 2) delta *= 200;

      // Accelerate based on wheel velocity
      wheelVelocity += delta * 0.1;

      // Apply velocity
      position += wheelVelocity;

      wrapPosition();
      applyTransform();

      // Slowly decay velocity for smooth glide
      wheelVelocity *= 0.9;

      // Reset snap timer
      if (wheelTimeout) clearTimeout(wheelTimeout);
      wheelTimeout = setTimeout(() => {
        snapToClosest();
        wheelVelocity = 0;
      }, 150); // snap after 150ms of no wheel events
    };




    /* =======================
       POINTER DRAG
    ======================= */
    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      startX = e.clientX;
      lastX = position;
      viewport.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const delta = e.clientX - startX;
      position = lastX - delta;
      correctLoop();
      applyTransform();
    };

    const CLICK_THRESHOLD = 5; // pixels; small movement is still considered a click

    const onPointerUp = (e: PointerEvent) => {
      viewport.releasePointerCapture(e.pointerId);

      const movedDistance = Math.abs(position - lastX);

      // Only snap if the user actually dragged
      if (movedDistance > CLICK_THRESHOLD) {
        snapToClosest();
      }

      isDragging = false;
    };

    /* =======================
       CLICK TO MOVE
    ======================= */
    const EDGE_THRESHOLD = 0.2; // 20% of viewport width

    const onClick = (e: MouseEvent) => {
      const clickX = e.clientX;
      const currentViewportWidth = viewport.clientWidth;
      const center = position + currentViewportWidth / 2 - bufferWidth;
      let currentIndex = Math.round(center / FULL);

      let delta = 0;

      if (clickX < EDGE_THRESHOLD * currentViewportWidth) {
        delta = -1; // move left
      } else if (clickX > currentViewportWidth * (1 - EDGE_THRESHOLD)) {
        delta = 1; // move right
      } else {
        return; // middle click → do nothing
      }

      // Special case: moving right from last panel
      if (currentIndex === PANELS.length - 1 && delta === 1) {
        // Animate to right buffer card
        const bufferPosition = bufferWidth + PANELS.length * FULL - currentViewportWidth / 2 + FULL / 2 - GAP / 2;
        track.style.transition = "transform 0.3s ease";
        position = bufferPosition;
        applyTransform();

        // After animation ends, teleport to the real first panel
        setTimeout(() => {
          track.style.transition = "none";
          position = bufferWidth - currentViewportWidth / 2 + FULL / 2 - GAP / 2;
          applyTransform();
        }, 300);

        return;
      }

      // Special case: moving left from first panel
      if (currentIndex === 0 && delta === -1) {
        const bufferPosition = bufferWidth - FULL - currentViewportWidth / 2 + FULL / 2 - GAP / 2;
        track.style.transition = "transform 0.3s ease";
        position = bufferPosition;
        applyTransform();

        setTimeout(() => {
          track.style.transition = "none";
          position = bufferWidth + (PANELS.length - 1) * FULL - currentViewportWidth / 2 + FULL / 2 - GAP / 2;
          applyTransform();
        }, 300);

        return;
      }

      // Normal click → move one panel
      let nextIndex = (currentIndex + delta + PANELS.length) % PANELS.length;
      const newPosition = bufferWidth + nextIndex * FULL - currentViewportWidth / 2 + FULL / 2 - GAP / 2;

      track.style.transition = "transform 0.3s ease";
      position = newPosition;
      applyTransform();

      setTimeout(() => {
        track.style.transition = "none";
      }, 300);
    };




    /* =======================
       LISTENERS
    ======================= */
    viewport.addEventListener("wheel", onWheel, { passive: false });
    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", onPointerUp);
    viewport.addEventListener("pointercancel", onPointerUp);
    viewport.addEventListener("click", onClick);

    return () => {
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", onPointerUp);
      viewport.removeEventListener("pointercancel", onPointerUp);
      viewport.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <main className="viewport" ref={viewportRef}>
      <div className="track" ref={trackRef}>
        {RENDERED_PANELS.map((panel, index) => (
          <section className="panel" key={index}>
            {panel}
          </section>
        ))}
      </div>
    </main>
  );
}

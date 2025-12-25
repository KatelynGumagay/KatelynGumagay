"use client";

import { useEffect, useRef, useState } from "react";

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
  const [centerIndex, setCenterIndex] = useState<number>(0);
  const [openIndex, setOpenIndex] = useState<number | null>(null);



  // ✅ NEW: ref to avoid stale resize issues
  const centerIndexRef = useRef<number>(0);
  const openIndexRef = useRef<number | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    openIndexRef.current = openIndex;
    if (!viewport || !track) return;

    /* =======================
       DIMENSIONS
    ======================= */

    const realCount = PANELS.length;
    const realWidth = realCount * FULL;
    const bufferWidth = BUFFER_COUNT * FULL;

    /* =======================
       STATE
    ======================= */

    let position = bufferWidth;

    const applyTransform = () => {
      track.style.transform = `translateX(${-position}px)`;
    };

    const centerToIndex = (index: number, animate = false) => {
      const vw = viewport.clientWidth;

      track.style.transition = animate ? "transform 0.4s ease" : "none";

      position =
        bufferWidth +
        index * FULL -
        vw / 2 +
        FULL / 2 -
        GAP / 2;

      applyTransform();
    };

    /* =======================
       INIT
    ======================= */

    if (centerIndexRef.current === null) {
      centerToIndex(0, false);
      centerIndexRef.current = 0;
    }

    applyTransform();

    /* =======================
       LOOP CORRECTION
    ======================= */

    const TELEPORT_MARGIN = viewport.clientWidth / 2;

    const correctLoop = () => {
      if (position < bufferWidth - TELEPORT_MARGIN) {
        track.style.transition = "none";
        position += realWidth;
        applyTransform();
        track.getBoundingClientRect();
      } else if (position > bufferWidth + realWidth - TELEPORT_MARGIN) {
        track.style.transition = "none";
        position -= realWidth;
        applyTransform();
        track.getBoundingClientRect();
      }
    };

    /* =======================
       SNAP
    ======================= */

    const snapToClosest = () => {
      const vw = viewport.clientWidth;
      const center = position + vw / 2 - bufferWidth;
      const index = Math.round(center / FULL);

      centerToIndex(index, true);

      setCenterIndex(index);
      centerIndexRef.current = index;

      setTimeout(() => {
        track.style.transition = "none";
      }, 300);
    };

    /* =======================
       MOMENTUM
    ======================= */

    let isMoving = false;
    let velocity = 0;
    let rafId: number | null = null;

    const FRICTION = 0.92;
    const MIN_VELOCITY = 0.1;

    const animate = () => {

      track.style.transition = "none";
      position += velocity;
      velocity *= FRICTION;

      correctLoop();
      applyTransform();

      if (Math.abs(velocity) > MIN_VELOCITY) {
        rafId = requestAnimationFrame(animate);
      } else {
        velocity = 0;
        rafId = null;
        isMoving = false;
        snapToClosest();
      }
    };

    const kick = () => {
      if (!rafId) {
        isMoving = true;
        setOpenIndex(null); // 🔑 close overlay ONCE
        rafId = requestAnimationFrame(animate);
      }
    };

    /* =======================
       WHEEL
    ======================= */

    let wheelTimeout: NodeJS.Timeout | null = null;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 20;
      if (e.deltaMode === 2) delta *= 200;

      velocity += delta * 0.12;
      kick();

      if (wheelTimeout) clearTimeout(wheelTimeout);
      wheelTimeout = setTimeout(() => {
        if (!rafId) snapToClosest();
      }, 150);
    };

  /* =======================
    POINTER DRAG + FLICK
  ======================= */

  const DRAG_START_THRESHOLD = 6; // px before drag activates
  const DEADZONE = FULL * 0.05;

  const BASE_FLICK = FULL * 0.06;        // 🔑 exactly 1 panel
  const STACK_FLICK = FULL * 0.6; // extra panels on rapid flicks
  const STACK_WINDOW = 260;       // ms
  const MAX_STACKS = 4;

  let isPointerDown = false;
  let isDragging = false;
  let didDrag = false;

  let pressX = 0;
  let dragStartPosition = 0;
  let lastFlickTime = 0;
  let stackCount = 0;

  const onPointerDown = (e: PointerEvent) => {
    isPointerDown = true;
    isDragging = false;
    didDrag = false;

    pressX = e.clientX;
    dragStartPosition = position;

    viewport.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isPointerDown) return;

    const dx = e.clientX - pressX;

    // ⛔ wait until user actually drags
    if (!isDragging) {
      if (Math.abs(dx) < DRAG_START_THRESHOLD) return;
      isDragging = true;
      didDrag = true;
    }

    // direct world-space drag
    position = dragStartPosition - dx *0.7;
    correctLoop();
    applyTransform();
  };

  const onPointerUp = (e: PointerEvent) => {
    viewport.releasePointerCapture(e.pointerId);
    isPointerDown = false;

    // ✅ Pure click — no movement
    if (!isDragging) {
      snapToClosest();
      return;
    }

    isDragging = false;

    const worldDelta = position - dragStartPosition;


    // direction in world space
    const direction = worldDelta > 0 ? 1 : -1;

    // stack logic
    const now = performance.now();
    if (now - lastFlickTime < STACK_WINDOW) {
      stackCount = Math.min(stackCount + 1, MAX_STACKS);
    } else {
      stackCount = 0;
    }
    lastFlickTime = now;

    // 🔑 guaranteed first flick = 1 panel
    velocity =
      direction *
      (BASE_FLICK + stackCount * STACK_FLICK);
    kick();
  };





    /* =======================
       CLICK
    ======================= */

    let edgeThreshold = 0.2;
    const CLICK_IMPULSE = FULL * 0.2;
    let lastClickTime = 0;

  const onClick = (e: MouseEvent) => {
    const vw = viewport.clientWidth;
    const clickX = e.clientX;
    const center = position + vw / 2 - bufferWidth;
    const currentIndex = Math.round(center / FULL);

    const overlayOpen = openIndex !== null;
    const overlayWidth = overlayRef.current?.offsetWidth ?? 0;
    // Only use overlay width if overlay is actually open
    const overlayEdgeThreshold = overlayOpen && overlayWidth > 0
      ? (vw - overlayWidth) / 2 / vw
      : 0.2;

    edgeThreshold = overlayEdgeThreshold;

    const clickedCenter =
      clickX > vw * edgeThreshold &&
      clickX < vw * (1 - edgeThreshold);

    // Only open overlay if it’s centered AND not moving AND click is in the safe area
  // Only open overlay if it's centered AND not moving AND overlay isn't open
    if (!isMoving && clickedCenter && !overlayOpen) {
      setOpenIndex(currentIndex);
      return; // ✅ exit early, don't touch velocity or kick
    }

    // Otherwise, treat click as edge flick only if overlay is closed

    let delta = 0;
    if (clickX < vw * edgeThreshold) delta = -0.8;
    else if (clickX > vw * (1 - edgeThreshold)) delta = 0.8;

    if (delta !== 0) {
      const now = Date.now();
      velocity += delta * CLICK_IMPULSE * (now - lastClickTime < 300 ? 1.5 : 0.5);
      lastClickTime = now;
      kick();
    }

  };


    /* =======================
       RESIZE
    ======================= */

    const onResize = () => {
      if (centerIndexRef.current === null) return;
      centerToIndex(centerIndexRef.current, false);
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
    window.addEventListener("resize", onResize);

    return () => {
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", onPointerUp);
      viewport.removeEventListener("pointercancel", onPointerUp);
      viewport.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <main className="viewport" ref={viewportRef}>
      <div className="track" ref={trackRef}>
        {RENDERED_PANELS.map((panel, index) => {
          const realIndex =
            ((index - BUFFER_COUNT) % PANELS.length + PANELS.length) %
            PANELS.length;

          const isCenter = realIndex === centerIndex;

          return (
            <section key={index} className={`panel ${isCenter ? "is-center" : ""}`}>
              <div className="panel-shell">
                <div className="panel-main">
                  <h2>{panel}</h2>
                  <p>Short description or icons</p>
                </div>

              </div>
            </section>

          );
        })}
      </div>

      {openIndex !== null && (
        <div className="overlay">
          <div className="overlay-card" ref={overlayRef}>
            <h2>{PANELS[openIndex]}</h2>
            <p>Deep dive content goes here</p>
            <button onClick={() => setOpenIndex(null)}>Close</button>
          </div>
        </div>
      )}
    </main>
  );
}

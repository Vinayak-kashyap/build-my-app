import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Award, Bell, Camera, Route as RouteIcon } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Get Started — RoadPulse" },
      {
        name: "description",
        content:
          "See how RoadPulse detects road damage, routes you safely, alerts authorities and rewards contributors.",
      },
      { property: "og:title", content: "Get Started — RoadPulse" },
      {
        property: "og:description",
        content: "A quick tour of AI road damage detection, safer routing and community rewards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

const slides = [
  {
    Icon: Camera,
    title: "Detect Road Damage Instantly",
    body: "Point your camera at the road — AI classifies potholes, cracks and waterlogging in seconds.",
  },
  {
    Icon: RouteIcon,
    title: "Navigate Safer Routes",
    body: "Damage-aware routing steers you around hazards and shows a health score for every route.",
  },
  {
    Icon: Bell,
    title: "Alert Authorities Automatically",
    body: "Critical damage is escalated to the right municipal team with photos, GPS and AI analysis.",
  },
  {
    Icon: Award,
    title: "Earn Rewards for Contributing",
    body: "Collect points, badges and streaks as your verified reports make roads safer for everyone.",
  },
];

function Onboarding() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const slide = slides[index];

  const finish = () => {
    localStorage.setItem("roadpulse.onboarded", "1");
    void navigate({ to: "/register" });
  };

  const next = () => (index === slides.length - 1 ? finish() : setIndex(index + 1));
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  return (
    <main className="flex min-h-screen flex-col bg-background px-6 py-6">
      <div className="flex justify-end">
        <button
          onClick={finish}
          className="tap-target rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Skip
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragStart={() => setDragging(true)}
            onDragEnd={(_, info) => {
              setDragging(false);
              if (info.offset.x < -80) next();
              else if (info.offset.x > 80) prev();
            }}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.28 }}
            className={`flex flex-col items-center text-center ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          >
            <motion.span
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2.4, repeat: Infinity }}
              className="flex h-28 w-28 items-center justify-center rounded-[2rem] bg-accent/12 text-accent shadow-glow ring-1 ring-accent/30"
            >
              <slide.Icon className="h-12 w-12" aria-hidden="true" />
            </motion.span>
            <h1 className="mt-10 text-2xl font-bold text-foreground">{slide.title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{slide.body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-10 flex justify-center gap-2" role="tablist" aria-label="Onboarding progress">
          {slides.map((s, i) => (
            <button
              key={s.title}
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}: ${s.title}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-6 bg-accent" : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-md">
        <button
          onClick={next}
          className="tap-target w-full rounded-xl bg-accent px-5 py-3.5 text-base font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          {index === slides.length - 1 ? "Get Started" : "Next"}
        </button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-accent">
            Sign In
          </Link>
        </p>
      </div>
    </main>
  );
}

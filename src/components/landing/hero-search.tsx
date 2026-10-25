"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlateInput } from "@/components/plate-input";
import { Button } from "@/components/ui";
import { parseVehicleIdentifier } from "@/lib/vrm";

/** Trial search box: looking up requires an account, so it routes to sign-up with the plate kept. */
export function HeroSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      // Without JS (or before hydration) the browser submits to /signup?vrm=... natively.
      action="/signup"
      className="mx-auto flex w-full max-w-xl flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = parseVehicleIdentifier(value);
        if (!parsed) {
          setError("Enter a valid registration, e.g. AB12 CDE");
          return;
        }
        const next = `/dashboard?vrm=${parsed.value}`;
        router.push(`/signup?vrm=${parsed.value}&next=${encodeURIComponent(next)}`);
      }}
    >
      <PlateInput
        aria-label="Vehicle registration"
        name="vrm"
        placeholder="AB12 CDE"
        value={value}
        onChange={(event) => {
          setValue(event.target.value.toUpperCase());
          setError(null);
        }}
      />
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <Button type="submit" size="lg" className="w-full">
        Get Paint Code
      </Button>
      <p className="text-center text-xs text-slate-500">Free account required to view results. No paint code = no charge.</p>
    </form>
  );
}

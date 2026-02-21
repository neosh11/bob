import { useEffect, useState } from "react";

/**
 * Track whether the provided media query currently matches.
 */
export function useMediaQuery(query: string): boolean {
  const getMatches = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false);

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(query);

    const handleChange = () => {
      setMatches(mediaQuery.matches);
    };

    handleChange();

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}

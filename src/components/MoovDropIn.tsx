import React, { useEffect, useRef } from "react";
import { getMoovConfig, getMockMoovAccessToken, loadMoovDropInScript } from "../lib/moovClient";

/**
 * Minimal Drop-in placeholder for Moov Onboarding.
 * - Loads the Drop-in script dynamically
 * - Mounts a <moov-onboarding> element with a mocked token
 * Replace token retrieval with a Supabase Edge Function in production.
 */
const MoovDropIn: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const { accountId } = getMoovConfig();

        if (!accountId) {
          // Still render a placeholder; developer must configure env
          // eslint-disable-next-line no-console
          console.warn("REACT_APP_MOOV_ACCOUNT_ID missing; Drop-in will not be functional.");
        }

        await loadMoovDropInScript();
        const token = await getMockMoovAccessToken();

        if (!isMounted || !containerRef.current) return;

        // Clear previous content if re-mounted
        containerRef.current.innerHTML = "";

        // Create the Moov Onboarding web component
        const onboardingEl = document.createElement("moov-onboarding");
        onboardingEl.setAttribute("token", token);
        if (accountId) {
          onboardingEl.setAttribute("facilitator-account-id", accountId);
        }

        containerRef.current.appendChild(onboardingEl);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to initialize Moov Drop-in:", err);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="moov-dropin-wrapper">
      {/* Placeholder container: Moov web component mounts inside */}
      <div ref={containerRef} />
    </div>
  );
};

export default MoovDropIn;



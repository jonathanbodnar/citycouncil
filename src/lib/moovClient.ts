/*
  Lightweight Moov Drop-in bootstrapper for CRA (no Node/Express backend).
  - Loads the Drop-in script from REACT_APP_MOOV_DROPIN_SRC
  - Exposes config from env
  - Provides a temporary mocked access token function
*/

type MoovEnvConfig = {
  publicKey: string | undefined;
  accountId: string | undefined;
  baseUrl: string | undefined;
  dropInSrc: string | undefined;
};

export const getMoovConfig = (): MoovEnvConfig => ({
  publicKey: process.env.REACT_APP_MOOV_PUBLIC_KEY,
  accountId: process.env.REACT_APP_MOOV_ACCOUNT_ID,
  baseUrl: process.env.REACT_APP_MOOV_BASE_URL,
  dropInSrc: process.env.REACT_APP_MOOV_DROPIN_SRC,
});

/**
 * Temporarily returns a mocked OAuth2 access token.
 * TODO: Replace with a Supabase Edge Function that requests a short-lived Moov access token server-side.
 */
export async function getMockMoovAccessToken(): Promise<string> {
  // IMPORTANT: Do NOT use a real token in client code. This is only for local prototyping.
  // Replace this with a call to your Supabase function when ready.
  const placeholderToken = "REPLACE_WITH_SERVER_ISSUED_TOKEN";
  return placeholderToken;
}

/**
 * Dynamically inject the Moov Drop-in script once. Resolves when the script loads.
 */
export function loadMoovDropInScript(): Promise<void> {
  const { dropInSrc } = getMoovConfig();
  if (!dropInSrc) {
    return Promise.reject(
      new Error(
        "REACT_APP_MOOV_DROPIN_SRC is not set. Provide the Moov Drop-in script URL."
      )
    );
  }

  const existing = document.querySelector(
    `script[data-moov-dropin-src="${dropInSrc}"]`
  ) as HTMLScriptElement | null;
  if (existing && (existing as any)._loaded) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = dropInSrc;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-moov-dropin-src", dropInSrc);

    script.onload = () => {
      (script as any)._loaded = true;
      // Minimal verification: script tag loaded. Drop-in components should now be defined.
      // Consumers can check for customElements or directly mount components.
      console.log("Moov initialized successfully");
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Moov Drop-in script"));

    document.head.appendChild(script);
  });
}



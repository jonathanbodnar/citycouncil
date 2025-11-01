/*
  Minimal typings for Moov Drop-in custom elements used in JSX to satisfy TypeScript.
  Adjust as Moov publishes official types.
*/

declare namespace JSX {
  interface IntrinsicElements {
    // Onboarding Drop-in element (tag name may vary by Moov version; update as needed)
    "moov-onboarding": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    > & {
      token?: string;
      "facilitator-account-id"?: string;
      [key: string]: any;
    };
  }
}



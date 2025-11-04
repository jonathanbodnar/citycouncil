import React from "react";
import MoovDropIn from "../components/MoovDropIn";

const OnboardingPage: React.FC = () => {
  return (
    <div style={{ padding: 24 }}>
      <h1>Onboarding</h1>
      <p>Moov Drop-in should mount below. Check the console for "Moov initialized successfully".</p>
      <MoovDropIn />
    </div>
  );
};

export default OnboardingPage;



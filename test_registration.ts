
import { saveUserProfile } from "./src/lib/supabase";

async function testRegistration() {
  console.log("Simulating Demo User (should skip)");
  await saveUserProfile(
    "00000000-0000-0000-0000-000000000001",
    { age: 25, city: "Bratislava" },
    ["url1"]
  );
  console.log("Simulation complete. If no errors above, it safely handles Demo user.");
}

testRegistration().catch(console.error);

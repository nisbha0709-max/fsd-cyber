// Usage:  npm run seed          (adds demo users + incidents if missing)
//         npm run seed:reset    (wipes users, incidents, evidence first)
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Incident = require("../models/Incident");
const Evidence = require("../models/Evidence");
const Counter = require("../models/Counter");
const SlaRule = require("../models/SlaRule");
const { createIncidentRecord } = require("../services/incidentService");

const PASSWORD = "Password@123";

const USERS = [
  { name: "Admin User", email: "admin@example.com", role: "admin" },
  { name: "Anita Analyst", email: "analyst@example.com", role: "analyst" },
  { name: "Ravi Responder", email: "responder1@example.com", role: "responder" },
  { name: "Divya Responder", email: "responder2@example.com", role: "responder" },
  { name: "Vikram Viewer", email: "viewer@example.com", role: "viewer" },
];

const INCIDENTS = [
  { title: "Ransomware detected on file server", description: "Files on FS-01 are being encrypted and a ransom note was found in the shared folder.", type: "ransomware", severity: "critical", affectedSystems: ["FS-01", "Finance share"] },
  { title: "Phishing campaign targeting HR", description: "Multiple HR staff received emails with a fake payroll login link; two users clicked.", type: "phishing", severity: "high", affectedSystems: ["Mail gateway"] },
  { title: "Unauthorized login attempts on VPN", description: "Hundreds of failed VPN logins from foreign IPs followed by one successful login.", type: "unauthorized_access", severity: "high", affectedSystems: ["VPN-GW"] },
  { title: "Outdated library flagged on web portal", description: "Dependency scan found a library with a known vulnerability on the student portal.", type: "vulnerability", severity: "medium", affectedSystems: ["Student portal"] },
  { title: "Suspicious USB usage in lab", description: "Endpoint protection reported an unknown USB device on a lab machine.", type: "malware", severity: "low", affectedSystems: ["LAB-PC-12"] },
];

(async () => {
  await connectDB();

  if (process.argv.includes("--reset")) {
    await Promise.all([User.deleteMany(), Incident.deleteMany(), Evidence.deleteMany(), Counter.deleteMany()]);
    console.log("Cleared users, incidents, evidence and counters (uploaded files on disk are not removed).");
  }

  await SlaRule.seedDefaults();

  for (const u of USERS) {
    if (!(await User.findOne({ email: u.email }))) {
      await User.create({ ...u, password: PASSWORD });
      console.log(`Created ${u.role}: ${u.email}`);
    }
  }

  if ((await Incident.countDocuments()) === 0) {
    const analyst = await User.findOne({ email: "analyst@example.com" });
    let last;
    for (const data of INCIDENTS) {
      const { incident } = await createIncidentRecord(data, analyst);
      last = incident;
      console.log(`Created ${incident.incidentNumber}: ${incident.title}`);
    }
    // Backdate the last one so the SLA job escalates it (handy for demos)
    await Incident.updateOne(
      { _id: last._id },
      { $set: { responseDueAt: new Date(Date.now() - 3600000), resolutionDueAt: new Date(Date.now() - 1800000) } }
    );
  }

  console.log(`\nDone. Log in with any seeded email and password: ${PASSWORD}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

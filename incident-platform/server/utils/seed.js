// Usage:  npm run seed          (adds demo users + incidents if missing)
//         npm run seed:reset    (wipes users, incidents, evidence first)
require("dotenv").config();
const mongoose = require("mongoose");
const faker = require("faker");
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

// Exported function to seed demo data without exiting the process
async function seedDemo() {
  // connectDB is called by server initialization; not needed here

  if (process.argv.includes("--reset")) {
    await Promise.all([User.deleteMany(), Incident.deleteMany(), Evidence.deleteMany(), Counter.deleteMany()]);
    console.log("Cleared users, incidents, evidence and counters (uploaded files on disk are not removed).");
  }

  await SlaRule.seedDefaults();

  // Seed users
  for (const u of USERS) {
    const existing = await User.findOne({ email: u.email });
    if (!existing) {
      await User.create({ ...u, password: PASSWORD });
      console.log(`Created ${u.role}: ${u.email}`);
    } else {
      existing.password = PASSWORD;
      await existing.save();
      console.log(`Reset password for ${u.role}: ${u.email}`);
    }
  }

  // Seed incidents (only if none exist)
  if ((await Incident.countDocuments()) === 0) {
    const analyst = await User.findOne({ email: "analyst@example.com" });
    // Generate extra demo incidents for richer dashboard / SLA demo
    async function createDemoIncidents(analyst) {
      const severities = ["critical", "high", "medium", "low"];
      const types = ["ransomware", "phishing", "unauthorized_access", "vulnerability", "malware"];
      const statuses = ["open", "in_progress", "resolved", "closed"];
      const responders = await User.find({ role: "responder", isActive: true }).select("_id name");
      for (let i = 0; i < 12; i++) {
        const daysAgo = Math.floor(Math.random() * 6);
        const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        const severity = faker.random.arrayElement(severities);
        const type = faker.random.arrayElement(types);
        const title = faker.lorem.sentence();
        const description = faker.lorem.paragraph();
        const affected = [faker.lorem.word()];
        let assignee = null;
        if (Math.random() < 0.7 && responders.length) {
          assignee = faker.random.arrayElement(responders);
        }
        const incidentData = { title, description, type, severity, affectedSystems: affected };
        const { incident } = await createIncidentRecord(incidentData, analyst, assignee?._id);
        // Override timestamps for demo
        incident.createdAt = createdAt;
        incident.updatedAt = createdAt;
        const rule = await SlaRule.findOne({ severity });
        incident.responseDueAt = new Date(createdAt.getTime() + rule.responseMinutes * 60 * 1000);
        incident.resolutionDueAt = new Date(createdAt.getTime() + rule.resolutionMinutes * 60 * 1000);
        const status = faker.random.arrayElement(statuses);
        incident.status = status;
        if (status === "resolved" || status === "closed") {
          const late = Math.random() < 0.5;
          incident.resolvedAt = late
            ? new Date(incident.resolutionDueAt.getTime() + 2 * 60 * 60 * 1000)
            : new Date(incident.resolutionDueAt.getTime() - 1 * 60 * 60 * 1000);
        }
        await incident.save();
      }
    }
    await createDemoIncidents(analyst);
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
}

module.exports = { seedDemo };

// If executed directly via npm script, run seedDemo and then disconnect
if (require.main === module) {
  (async () => {
    try {
      await seedDemo();
      await mongoose.disconnect();
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  })();
}
// Duplicate seed block removed - original top-level await code eliminated to prevent runtime errors);

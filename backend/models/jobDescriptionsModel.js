const mongoose = require("mongoose");
const { Schema } = mongoose;

const jobDescriptionSchema = new Schema({
  role: { type: String, required: true },
  managementlvl: { type: Number },
  supervisor: { type: Schema.Types.ObjectId },
  reportingUsers: [{ type: Schema.Types.ObjectId }],
  usersAssigned: [{ type: Schema.Types.ObjectId }],
});

const JobDescription = mongoose.model("JobDescription", jobDescriptionSchema);

module.exports = JobDescription;

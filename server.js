const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");

dotenv.config();

const app = express();

const uploadsRoot = path.resolve(
  process.env.UPLOADS_PATH ||
    "/home/u921816028/domains/backpackboyys.com/uploads"
);

const videosDirectory = path.join(uploadsRoot, "videos");
const thumbnailsDirectory = path.join(uploadsRoot, "thumbnails");

fs.mkdirSync(videosDirectory, { recursive: true });
fs.mkdirSync(thumbnailsDirectory, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Serve persistent uploads outside public_html.
app.use(
  "/uploads",
  express.static(uploadsRoot, {
    fallthrough: true
  })
);

const db = require("./config/database");

app.use(cookieParser());
app.use("/api/auth", require("./routes/auth"));
app.use("/api/videos", require("./routes/videos"));
app.use("/api/users", require("./routes/users"));
app.use("/api/admin", require("./routes/admin"));

app.get("/api/health", (req, res) => {
  res.json({
    status: "Server running"
  });
});

const buildPath = path.join(__dirname, "client/build");

if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));

  app.get("/", (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });

  app.get("*", (req, res) => {
    if (
      !req.url.startsWith("/api") &&
      !req.url.startsWith("/uploads")
    ) {
      res.sendFile(path.join(buildPath, "index.html"));
    }
  });
} else {
  app.get("/", (req, res) => {
    res.json({
      status: "Backend API running",
      message:
        'React frontend not built yet. Run "npm run build" to build the client.',
      apiEndpoints: {
        auth: "/api/auth",
        videos: "/api/videos",
        users: "/api/users"
      }
    });
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    error: "Something went wrong!"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Persistent uploads directory: ${uploadsRoot}`);

  if (fs.existsSync(buildPath)) {
    console.log("React frontend: READY");
  } else {
    console.log(
      "React frontend: NOT BUILT. Run the client build command."
    );
  }
});

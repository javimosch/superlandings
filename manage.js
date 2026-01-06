#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

async function selectEnvFile() {
  if (process.env.ENV_FILE) {
    return process.env.ENV_FILE;
  }

  const files = fs.readdirSync(process.cwd());
  const envFiles = files.filter(
    (f) => f.startsWith(".env") && f !== ".env.example",
  );

  if (envFiles.length <= 1) {
    return envFiles[0] || ".env";
  }

  console.log("Multiple environment files detected:");
  envFiles.forEach((file, idx) => {
    console.log(`${idx + 1}. ${file}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const choice = await new Promise((resolve) => {
    rl.question(
      `Select an environment file (1-${envFiles.length}, default 1): `,
      (answer) => {
        resolve(answer.trim());
      },
    );
  });

  rl.close();

  const index = parseInt(choice) - 1;
  if (isNaN(index) || index < 0 || index >= envFiles.length) {
    if (choice !== "") {
      console.log(`Invalid selection, using ${envFiles[0]}`);
    }
    return envFiles[0];
  }

  return envFiles[index];
}

async function main() {
  const envFile = await selectEnvFile();
  process.env.ENV_FILE = envFile;

  // Load environment variables
  require("dotenv").config({
    path: envFile,
  });

  // Default values for environment variables
  const config = {
    REMOTE_USER: process.env.REMOTE_HOST_USER || "ubuntu",
    REMOTE_HOST: process.env.REMOTE_HOST,
    REMOTE_PORT: process.env.REMOTE_HOST_PORT || "22",
    REMOTE_PATH: process.env.REMOTE_HOST_PATH || "~/docker/mufc-booking-v2",
    LOCAL_PATH: process.cwd(),
    REMOTE_SYNC_EXCLUDES:
      process.env.REMOTE_SYNC_EXCLUDES || "frontend/node_modules",
    APP_NAME: process.env.APP_NAME,
    MODE: process.env.MODE || "staging",
    REMOTE_DOMAIN_CONFIG_FILENAME: process.env.REMOTE_DOMAIN_CONFIG_FILENAME,
    DOMAIN_REMOTE_USER: "root",
    DOMAIN_REMOTE_HOST: process.env.REMOTE_DOMAIN_HOST,
    DOMAIN_REMOTE_PORT: process.env.REMOTE_DOMAIN_PORT || "22",
    DOMAIN_REMOTE_TRAEFIK_PATH: "/data/coolify/proxy/dynamic",
    PROXY_FILE: `.manage-proxy-file-${process.env.MODE || "staging"}.yml`,
    REMOTE_SERVICE_IP: process.env.REMOTE_SERVICE_IP,
    PUBLISHED_DOMAIN: process.env.PUBLISHED_DOMAIN,
    COMPOSE_FILE: process.env.COMPOSE_FILE,
  };

  console.log("Env file: ", process.env.ENV_FILE);
  console.log("Mode: ", process.env.MODE || "staging");
  console.log("Will use compose file: ", config.COMPOSE_FILE);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function prompt(question) {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  function findComposeFiles() {
    const files = [
      "compose.prod.yml",
      "docker-compose.yml",
      "docker-compose.yaml",
      "compose.yml",
      "compose.yaml",
      "compose.image.yml",
    ];
    const found = [];
    for (const file of files) {
      if (fs.existsSync(path.join(config.LOCAL_PATH, file))) {
        found.push(file);
      }
    }
    return found;
  }

  function detectComposeFile() {
    if (config.COMPOSE_FILE) return config.COMPOSE_FILE;

    const files = findComposeFiles();
    return files.length > 0 ? files[0] : null;
  }

  function validateEnvVars() {
    const missing = [];

    if (!config.REMOTE_HOST) missing.push("REMOTE_HOST");
    if (!config.REMOTE_USER) missing.push("REMOTE_USER");

    if (missing.length > 0) {
      console.error(
        `❌ Error: Missing environment variables: ${missing.join(", ")}`,
      );
      return false;
    }

    return true;
  }

  function validateDomainEnvVars() {
    const missing = [];

    if (!config.DOMAIN_REMOTE_HOST) missing.push("REMOTE_DOMAIN_HOST");
    if (!config.REMOTE_SERVICE_IP) missing.push("REMOTE_SERVICE_IP");
    if (!config.PUBLISHED_DOMAIN) missing.push("PUBLISHED_DOMAIN");

    if (missing.length > 0) {
      console.error(
        `❌ Error: Missing environment variables: ${missing.join(", ")}`,
      );
      return false;
    }

    const proxyFile = path.join(config.LOCAL_PATH, config.PROXY_FILE);
    if (!fs.existsSync(proxyFile)) {
      console.error(
        `❌ Error: ${config.PROXY_FILE} not found in ${config.LOCAL_PATH}`,
      );
      console.error(
        "Please create the proxy file first using 'node manage.js proxy'",
      );
      return false;
    }

    return true;
  }

  async function followLogs() {
    console.log("📜 Following logs on remote server...");

    const composeFile = detectComposeFile();
    if (!composeFile) {
      console.error(
        "❌ Error: No compose file found locally. Please provide one via COMPOSE_FILE env var.",
      );
      return;
    }

    console.log(`Using compose file: ${composeFile}`);

    const sshCmd = `ssh -t -p ${config.REMOTE_PORT} ${config.REMOTE_USER}@${config.REMOTE_HOST} "cd ${config.REMOTE_PATH} && docker compose -f ${composeFile} logs -f app automation-api"`;

    try {
      execSync(sshCmd, { stdio: "inherit" });
    } catch (error) {
      console.error("❌ Error following logs");
    }
  }

  async function deployApp() {
    console.log("Starting deployment to remote server...");

    if (!validateEnvVars()) return;

    const composeFile = detectComposeFile();
    if (!composeFile) {
      console.error(
        "❌ Error: No compose file found locally. Please provide one via COMPOSE_FILE env var.",
      );
      return;
    }

    console.log(
      `🔧 Ensuring remote directory exists at ${config.REMOTE_PORT} ${config.REMOTE_USER}:${config.REMOTE_HOST}:${config.REMOTE_PATH}...`,
    );
    execSync(
      `ssh -p ${config.REMOTE_PORT} ${config.REMOTE_USER}@${config.REMOTE_HOST} "mkdir -p ${config.REMOTE_PATH}"`,
      { stdio: "inherit" },
    );

    console.log(`📦 Syncing local files from ${config.LOCAL_PATH} to remote...`);

    const excludes = config.REMOTE_SYNC_EXCLUDES.split(/[,\s]+/).filter((e) =>
      e.trim(),
    );
    let rsyncCmd = `rsync -avz --exclude=.git`;
    excludes.forEach((ex) => {
      if (ex) rsyncCmd += ` --exclude=${ex}`;
    });
    rsyncCmd += ` --progress -e "ssh -p ${config.REMOTE_PORT}" ${config.LOCAL_PATH}/ ${config.REMOTE_USER}@${config.REMOTE_HOST}:${config.REMOTE_PATH}/`;

    console.log(`Using rsync excludes: ${excludes.join(", ")}`);
    execSync(rsyncCmd, { stdio: "inherit" });

    console.log("🐳 Running docker compose on remote host...");
    const remoteCmd =
      `cd ${config.REMOTE_PATH} && ` +
      `echo "Using compose file: ${composeFile}" && ` +
      `echo "📥 Pulling latest images..." && ` +
      `docker compose -f "${composeFile}" pull && ` +
      `echo "🔄 Stopping containers..." && ` +
      `docker compose -f "${composeFile}" down && ` +
      `echo "🚀 Starting containers..." && ` +
      `docker compose -f "${composeFile}" up -d && ` +
      `echo "⏳ Waiting 5 seconds for containers to start..." && ` +
      `sleep 5 && ` +
      `echo "📜 Tailing last 100 lines of logs from all services..." && ` +
      `docker compose -f "${composeFile}" logs --tail=100`;

    execSync(
      `ssh -p ${config.REMOTE_PORT} ${config.REMOTE_USER}@${config.REMOTE_HOST} "${remoteCmd}"`,
      { stdio: "inherit" },
    );

    console.log("✅ Deployment complete.");
  }

  async function deployDomain() {
    console.log("Starting domain deployment to Traefik gateway...");

    if (!validateDomainEnvVars()) return;

    const proxyFile = path.join(config.LOCAL_PATH, config.PROXY_FILE);

    console.log("Preview of the proxy file to be deployed:");
    console.log("------------------------");
    console.log(fs.readFileSync(proxyFile, "utf8"));
    console.log("------------------------");

    const remotePath = `${config.DOMAIN_REMOTE_TRAEFIK_PATH}/${config.REMOTE_DOMAIN_CONFIG_FILENAME || config.PROXY_FILE}`;
    console.log("Preview of the remote path to copy into:");
    console.log("------------------------");
    console.log(remotePath);
    console.log("------------------------");

    const confirm = await prompt(
      "Do you want to continue with the deployment? (y/n) ",
    );
    if (!/^[Yy]$/.test(confirm)) {
      console.log("Deployment cancelled.");
      return;
    }

    console.log(
      `🔄 Deploying domain configuration to ${config.DOMAIN_REMOTE_HOST}...`,
    );

    console.log("🔧 Checking if remote Traefik directory exists...");
    execSync(
      `ssh -p ${config.DOMAIN_REMOTE_PORT} ${config.DOMAIN_REMOTE_USER}@${config.DOMAIN_REMOTE_HOST} "mkdir -p ${config.DOMAIN_REMOTE_TRAEFIK_PATH}"`,
      { stdio: "inherit" },
    );

    console.log("📦 Copying Traefik configuration to remote server...");
    execSync(
      `scp -P ${config.DOMAIN_REMOTE_PORT} "${proxyFile}" ${config.DOMAIN_REMOTE_USER}@${config.DOMAIN_REMOTE_HOST}:${remotePath}`,
      { stdio: "inherit" },
    );

    console.log("🔄 Verifying file was copied successfully...");
    execSync(
      `ssh -p ${config.DOMAIN_REMOTE_PORT} ${config.DOMAIN_REMOTE_USER}@${config.DOMAIN_REMOTE_HOST} "ls -la ${remotePath}"`,
      { stdio: "inherit" },
    );

    console.log("✅ Domain configuration deployment complete.");
    const domains = String(config.PUBLISHED_DOMAIN || "")
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    const primaryDomain = domains[0] || config.PUBLISHED_DOMAIN;

    console.log(
      `🌐 Your API should now be accessible at: https://${primaryDomain}`,
    );
    console.log(
      `\ncURL to test the API:\ncurl https://${primaryDomain}/health`,
    );

    let attempts = 0;
    while (true) {
      console.log(`Waiting for API to be accessible... (${attempts} times)`);

      try {
        const result = execSync(`curl -s https://${primaryDomain}/health`, {
          encoding: "utf8",
        });
        if (result.includes("ok")) {
          console.log(`✅ API is now accessible at: https://${primaryDomain}`);
          break;
        }
      } catch (e) {
        // Try checking for 20x status code
        try {
          const statusCode = execSync(
            `curl -s -o /dev/null -w "%{http_code}" https://${primaryDomain}`,
            { encoding: "utf8" },
          );
          if (statusCode.startsWith("20")) {
            console.log(
              `✅ API is now accessible at: https://${primaryDomain}`,
            );
            break;
          }
        } catch (e2) {}
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    }
  }

  async function createProxyFile() {
    console.log("Creating proxy file...");

    if (!config.REMOTE_SERVICE_IP) {
      console.error("❌ Error: REMOTE_SERVICE_IP is not set in .env");
      return;
    }

    if (!config.PUBLISHED_DOMAIN) {
      console.error("❌ Error: PUBLISHED_DOMAIN is not set in .env");
      return;
    }

    const exampleServiceName = (config.APP_NAME || "service")
      .replace(/\s+/g, "-")
      .toLowerCase();

    const serviceName =
      (await prompt(
        `Enter the Traefik service name (default: ${exampleServiceName}): `,
      )) || exampleServiceName;

    const traefikServiceName = serviceName.endsWith(`-${config.MODE}`)
      ? serviceName
      : `${serviceName}-${config.MODE}`;

    console.log("🔧 Creating proxy file...");
    console.log(`Service name: ${traefikServiceName}`);
    console.log(`Published domain: ${config.PUBLISHED_DOMAIN}`);
    console.log(`Remote service IP: ${config.REMOTE_SERVICE_IP}`);

    const domains = String(config.PUBLISHED_DOMAIN || "")
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);

    //e.g rule: microexits.coolify.intrane.fr || dev.microexits.com
    const ruleHostPart =
      domains.length === 1
        ? `Host(\`${domains[0]}\`)`
        : domains.length > 1
          ? `${domains.map((d) => `Host(\`${d}\`)`).join(" || ")}`
          : `Host(\`${config.PUBLISHED_DOMAIN}\`)`;

    const template = `http:
  routers:
    ${traefikServiceName}:
      entryPoints:
        - https
      service: ${traefikServiceName}
      rule: ${ruleHostPart}
      tls:
        certresolver: letsencrypt
  services:
    ${traefikServiceName}:
      loadBalancer:
        servers:
          -
            url: '${config.REMOTE_SERVICE_IP}'`;

    const proxyFile = path.join(config.LOCAL_PATH, config.PROXY_FILE);
    fs.writeFileSync(proxyFile, template, "utf8");

    console.log(`✅ Proxy file created successfully at ${proxyFile}`);
    console.log("Preview of the proxy file:");
    console.log("------------------------");
    console.log(template);
    console.log("------------------------");
  }

  function parseComposeFile(composeFile) {
    const content = fs.readFileSync(composeFile, "utf8");
    const services = [];
    const images = [];

    const lines = content.split("\n");
    let currentService = null;
    let inServices = false;

    for (let line of lines) {
      const trimmed = line.trim();

      if (trimmed === "services:") {
        inServices = true;
        continue;
      }

      if (inServices && line.match(/^\w/) && !line.startsWith(" ")) {
        inServices = false;
      }

      if (inServices && line.match(/^  \w+:/)) {
        currentService = line.match(/^  (\w+):/)[1];
        services.push(currentService);
      }

      if (currentService && trimmed.startsWith("image:")) {
        const image = trimmed.replace("image:", "").trim();
        images.push({ service: currentService, image });
      }

      if (currentService && trimmed.startsWith("build:")) {
        images.push({ service: currentService, image: null, hasBuild: true });
      }
    }

    return { services, images };
  }

  async function buildImage() {
    console.log("🔨 Starting build process...");

    const composeFiles = findComposeFiles();
    if (composeFiles.length === 0) {
      console.error(
        "❌ Error: No compose files found in the current directory.",
      );
      return;
    }

    let selectedComposeFile;

    if (composeFiles.length === 1) {
      selectedComposeFile = composeFiles[0];
      console.log(`Using compose file: ${selectedComposeFile}`);
    } else {
      console.log("Available compose files:");
      composeFiles.forEach((file, idx) => {
        console.log(`  ${idx + 1}. ${file}`);
      });

      const choice = await prompt("Select a compose file (enter number): ");
      const choiceNum = parseInt(choice);

      if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > composeFiles.length) {
        console.error("❌ Invalid selection");
        return;
      }

      selectedComposeFile = composeFiles[choiceNum - 1];
    }

    const { images } = parseComposeFile(
      path.join(config.LOCAL_PATH, selectedComposeFile),
    );
    const buildableImages = images.filter((img) => img.image || img.hasBuild);

    if (buildableImages.length === 0) {
      console.error("❌ Error: No images found in the selected compose file.");
      return;
    }

    console.log(`\n🔧 Building images from ${selectedComposeFile}...`);

    try {
      execSync(`docker compose -f ${selectedComposeFile} build`, {
        stdio: "inherit",
        cwd: config.LOCAL_PATH,
      });
      console.log("✅ Build complete!");
    } catch (error) {
      console.error("❌ Build failed");
      return;
    }

    console.log("\nAvailable images to push:");
    buildableImages.forEach((img, idx) => {
      const displayName = img.image || `${img.service} (built locally)`;
      console.log(`  ${idx + 1}. ${displayName}`);
    });

    const pushConfirm = await prompt("\nDo you want to push an image? (y/n) ");
    if (!/^[Yy]$/.test(pushConfirm)) {
      console.log("Push cancelled.");
      return;
    }

    const imageChoice = await prompt(
      "Select an image to push (enter number): ",
    );
    const imageChoiceNum = parseInt(imageChoice);

    if (
      isNaN(imageChoiceNum) ||
      imageChoiceNum < 1 ||
      imageChoiceNum > buildableImages.length
    ) {
      console.error("❌ Invalid selection");
      return;
    }

    const selectedImage = buildableImages[imageChoiceNum - 1];
    const imageName = selectedImage.image;

    if (!imageName) {
      console.error(
        '❌ Error: No image name specified for this service. Please add an "image:" field in the compose file.',
      );
      return;
    }

    console.log(`\n📤 Pushing image: ${imageName}...`);

    try {
      execSync(`docker push ${imageName}`, {
        stdio: "inherit",
        cwd: config.LOCAL_PATH,
      });
      console.log("✅ Push complete!");
    } catch (error) {
      console.error("❌ Push failed");
    }
  }

  function showEnvVars() {
    console.log("===== Current Environment Variables =====");
    console.log(`REMOTE_HOST: ${config.REMOTE_HOST}`);
    console.log(`REMOTE_USER: ${config.REMOTE_USER}`);
    console.log(`REMOTE_PORT: ${config.REMOTE_PORT}`);
    console.log(`REMOTE_PATH: ${config.REMOTE_PATH}`);
    console.log(`COMPOSE_FILE: ${config.COMPOSE_FILE}`);
    console.log(`DOMAIN_REMOTE_HOST: ${config.DOMAIN_REMOTE_HOST}`);
    console.log(`DOMAIN_REMOTE_USER: ${config.DOMAIN_REMOTE_USER}`);
    console.log(`DOMAIN_REMOTE_PORT: ${config.DOMAIN_REMOTE_PORT}`);
    console.log(`REMOTE_SERVICE_IP: ${config.REMOTE_SERVICE_IP}`);
    console.log(`PUBLISHED_DOMAIN: ${config.PUBLISHED_DOMAIN}`);
    console.log(`REMOTE_SYNC_EXCLUDES: ${config.REMOTE_SYNC_EXCLUDES}`);
  }

  function showHelp() {
    console.log(
      `===== ${config.APP_NAME || "Application"} Management Script =====`,
    );
    console.log("Usage: node manage.js [OPTION]");
    console.log("");
    console.log("Options:");
    console.log("  logs    - Follow logs in remote server");
    console.log("  deploy  - Deploy application to remote server");
    console.log("  proxy   - Create proxy configuration file");
    console.log("  domain  - Deploy domain to remote (Traefik gateway)");
    console.log("  build   - Build and optionally push Docker images");
    console.log("  env     - Show environment variables");
    console.log("  help    - Show this help message");
    console.log("");
    console.log(
      "If no option is provided, an interactive menu will be displayed.",
    );
  }

  async function showMenu() {
    console.log(`\n===== ${config.APP_NAME || "Application"} Management =====`);
    console.log("1. Follow logs in remote");
    console.log("2. Deploy to remote");
    console.log("3. Create proxy configuration file");
    console.log("4. Deploy domain to remote (Traefik gateway)");
    console.log("5. Build and push Docker images");
    console.log("6. Show environment variables");
    console.log("7. Exit");

    const choice = await prompt("\nPlease select an option (1-7): ");

    switch (choice.trim()) {
      case "1":
        await followLogs();
        break;
      case "2":
        await deployApp();
        break;
      case "3":
        await createProxyFile();
        break;
      case "4":
        await deployDomain();
        break;
      case "5":
        await buildImage();
        break;
      case "6":
        showEnvVars();
        break;
      case "7":
        console.log("Exiting...");
        rl.close();
        process.exit(0);
      default:
        console.log("❌ Invalid option. Please try again.");
        await showMenu();
    }

    rl.close();
  }

  const args = process.argv.slice(2);

  if (args.length === 0) {
    await showMenu();
  } else {
    const command = args[0];

    switch (command) {
      case "logs":
        await followLogs();
        rl.close();
        break;
      case "deploy":
        await deployApp();
        rl.close();
        break;
      case "proxy":
        await createProxyFile();
        rl.close();
        break;
      case "domain":
        await deployDomain();
        rl.close();
        break;
      case "build":
        await buildImage();
        rl.close();
        break;
      case "env":
        showEnvVars();
        rl.close();
        break;
      case "help":
        showHelp();
        rl.close();
        break;
      default:
        console.log(`Unknown option: ${command}`);
        showHelp();
        rl.close();
        process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error("Error:", error);
  rl.close();
  process.exit(1);
});

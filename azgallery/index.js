import {Command} from "commander";
import create from "./create.js";
import build from "./build.js";
import {getVersion} from "./utils.js";

const command = new Command();

command
  .version(getVersion(), "-v, --version", "Print version number.")
  .usage("<subcommand> [options] [dir]")
  .description(`AZGallery v${getVersion()}`)
  .helpOption("-h, --help", "Print help information.")
  .addHelpCommand("help [subcommand]", "Print help information.");

command.command("create").alias("c")
  .argument("[dir]", "Project dir.")
  .description("Create a new album.")
  .option("-d, --debug", "Enable debug output.")
  .option("-c, --config <json>", "Alternative config path.")
  .option("-i, --image <path...>", "Append image to album.")
  .option("-t, --text <string...>", "Append text to album.")
  .option("-D, --date [YYYY-MM-DDTHH:mm:ss]", "Set album created date.")
  .option("-T, --no-text", "Do not ask text for this album.")
  .option("-Z, --no-compress", "Do not compress images.")
  .option("-C, --no-color", "Disable colored output.")
  .helpOption("-h, --help", "Print help information.")
  .action((dir, opts) => {
    create(dir || ".", opts);
  });

command.command("build").alias("b")
  .argument("[dir]", "Project dir.")
  .description("Build gallery.")
  .option("-d, --debug", "Enable debug output.")
  .option("-c, --config <json>", "Alternative config path.")
  .option("-C, --no-color", "Disable colored output.")
  .helpOption("-h, --help", "Print help information.")
  .action((dir, opts) => {
    build(dir || ".", opts);
  });

// Handle unknown commands.
command.on("command:*", () => {
  console.error(`Invalid command: ${command.args.join(" ")}`);
  console.error("Run `azgallery --help` for a list of available commands.");
  process.exit(1);
});

const azgallery = (argv = process.argv) => {
  command.parse(argv);
};

export default azgallery;

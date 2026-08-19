import dgram from "node:dgram";

function getLanAddress(): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");

    socket.once("error", (error) => {
      socket.close();
      reject(error);
    });

    // Aucune donnée n'est envoyée : la connexion UDP sert uniquement à demander
    // à Windows quelle interface réseau fournit la route locale par défaut.
    socket.connect(53, "8.8.8.8", () => {
      const address = socket.address().address;
      socket.close();
      resolve(address);
    });
  });
}

const lanAddress = await getLanAddress();

console.log(`MerchantHQ sera disponible sur exp://${lanAddress}:8081`);
console.log("La tablette doit être connectée au même réseau Wi-Fi.");

const expo = Bun.spawn(
  ["bun", "expo", "start", "--lan", ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      EXPO_NO_DEPENDENCY_VALIDATION: "1",
      REACT_NATIVE_PACKAGER_HOSTNAME: lanAddress,
    },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  },
);

process.on("SIGINT", () => expo.kill());
process.on("SIGTERM", () => expo.kill());

process.exit(await expo.exited);

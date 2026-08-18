declare const Bun: {
  spawn: (
    command: string[],
    options: {
      cwd: string;
      env: Record<string, string | undefined>;
      stdin: "inherit";
      stdout: "inherit";
      stderr: "inherit";
    },
  ) => {
    exited: Promise<number>;
    kill: () => void;
  };
};

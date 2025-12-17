import shell from "shelljs";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";

const REPO_URL = "https://github.com/Lin-PQ/react-playground.git";

// 0. 判断是否为 Windows 系统
const isWin = process.platform === "win32";

/**
 * 封装通用执行函数
 * @param {string} command 命令
 * @param {string} cwd 执行目录 (Current Working Directory)
 * @param {string} startText 开始提示
 * @param {string} succeedText 成功提示
 */
function execWithSpinner(command, cwd, startText, succeedText) {
  const spinner = ora(startText).start();

  return new Promise((resolve, reject) => {
    // 关键点：显式传入 cwd (执行目录)，不依赖全局 shell.cd
    shell.exec(
      command,
      { async: true, silent: true, cwd: cwd },
      (code, stdout, stderr) => {
        if (code === 0) {
          spinner.succeed(succeedText);
          resolve(stdout);
        } else {
          spinner.fail(chalk.red("操作失败"));
          // 打印 stderr 方便调试，如果为空则打印 stdout
          console.error(stderr || stdout);
          reject(new Error(`Command failed: ${command}`));
        }
      }
    );
  });
}

async function init() {
  console.log(chalk.blue.bold("🚀  My React CLI \n"));

  const { projectName } = await inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message: "请输入项目名称:",
      default: "my-app",
      validate: input => (input ? true : "项目名称不能为空"),
    },
  ]);

  // 目标绝对路径
  const targetPath = path.join(process.cwd(), projectName);

  if (fs.existsSync(targetPath)) {
    console.log(chalk.red(`❌ 目录 ${projectName} 已存在，请重试。`));
    process.exit(1);
  }

  try {
    // 1. 拉取代码
    // 注意：clone 命令不需要指定 cwd，因为它本身就是要在当前目录下创建新文件夹
    await execWithSpinner(
      `git clone ${REPO_URL} ${projectName}`,
      process.cwd(),
      "正在下载模板...",
      "模板下载完成"
    );

    // 2. 切断 Git 关联
    const spinnerClean = ora("正在清理 Git 记录...").start();
    shell.rm("-rf", path.join(targetPath, ".git"));
    spinnerClean.succeed("Git 记录已清理");

    // 3. 初始化新 Git
    // 这里的 git 操作都在 targetPath 下进行，所以我们直接用 shelljs 的同步方法即可，
    // 记得传入 { cwd: targetPath }
    shell.exec("git init", { silent: true, cwd: targetPath });
    shell.exec("git add .", { silent: true, cwd: targetPath });
    shell.exec('git commit -m "feat: init"', { silent: true, cwd: targetPath });
    shell.exec("git branch -M main", { silent: true, cwd: targetPath });

    // 4. 修改 package.json
    const pkgPath = path.join(targetPath, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    pkg.name = projectName;
    pkg.version = "1.0.0";
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

    // 5. 安装依赖 (关键修改点！)
    // Windows 下必须调用 pnpm.cmd / npm.cmd，否则容易卡死或无法识别
    const installCmd = isWin ? "pnpm.cmd install" : "pnpm install";

    await execWithSpinner(
      installCmd,
      targetPath, // 显式传入目标目录
      "正在安装依赖 (这可能需要几分钟)...",
      "依赖安装完成！"
    );

    console.log(chalk.green(`\n✨  项目 ${projectName} 创建成功！`));
    console.log(chalk.cyan(`\n👉  cd ${projectName}`));
    console.log(chalk.cyan(`👉  pnpm dev \n`));
  } catch (error) {
    // 错误信息上面已经打印了，这里静默退出即可
    process.exit(1);
  }
}

init();

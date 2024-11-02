import { exec } from 'child_process';

const otherScripts = [
    'node unichain.js',
];

function runScripts(scripts) {
    scripts.forEach(script => {
        exec(script, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing ${script}:`, error);
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
                return;
            }
            console.log(`Output of ${script}:\n${stdout}`);
        });
    });
}

// Run the scripts immediately and then start intervals
function startIntervals() {
    runScripts(otherScripts);
}

// Start the process
startIntervals();

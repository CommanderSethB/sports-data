const { fork } = require('child_process');

// Spawn the child process
const child1 = fork('./NFL/updateFiles.js');
const child2 = fork('./NCAAFB/updateFiles.js');
const child3 = fork('./NASCAR/updateFiles.js');




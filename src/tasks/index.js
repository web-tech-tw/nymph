"use strict";

const allTasks = [];

exports.startJobs = () => {
    for (const task of allTasks) {
        setInterval(task.action, task.sleep);
    }
};

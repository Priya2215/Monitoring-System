// Import required modules
const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const os = require('os-utils');
const si = require('systeminformation');
const { exec } = require('child_process');

// Create Express app
const app = express();
const port = 3000;

// MongoDB connection URI
const uri = 'mongodb+srv://priyalia2515:Priyadav.15@cluster0.kinlnqi.mongodb.net/';
const client = new MongoClient(uri, { useUnifiedTopology: true });

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
}
connectToMongoDB();

// Route handler for the home page
app.get('/', async (req, res) => {
    try {
        // Retrieve system usage data
        const cpuUsage = await getCpuUsage();
        const memoryUsage = await getMemoryUsage();
        const ramUsage = await getRamUsage();
        const diskUsage = await getDiskUsage();

        // Detect anomalies
        const { cpuWarning, memoryWarning, ramWarning, diskWarning } = await detectAnomaly(cpuUsage, memoryUsage, ramUsage, diskUsage);

        // Insert data into MongoDB
        await insertDataIntoMongoDB(cpuUsage, memoryUsage, ramUsage, diskUsage);

        // Retrieve data from MongoDB
        const data = await retrieveDataFromMongoDB();

        console.log('Data retrieved from MongoDB:', data);

        // Render the template with data and warning messages
        res.render('index', { 
            data,
            cpuWarning, 
            memoryWarning, 
            ramWarning, 
            diskWarning 
        });

    } catch (error) {
        console.error('Error retrieving data:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route handler for clearing RAM cache
app.post('/clear-ram-cache', async (req, res) => {
    try {
        await clearCache();
        console.log('Cache cleared successfully');
        res.status(200).send('RAM cache cleared successfully');
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).send('Error clearing RAM cache');
    }
});

// Set the view engine to EJS
app.set('view engine', 'ejs');

// Set up static files (CSS)
app.use(express.static(path.join(__dirname, 'public')));

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

// Helper functions
async function getCpuUsage() {
    return new Promise((resolve, reject) => {
        os.cpuUsage((v) => {
            resolve(v * 100); // Convert to percentage
        });
    });
}

async function getMemoryUsage() {
    const memoryInfo = await si.mem();
    return (memoryInfo.used / memoryInfo.total) * 100; // Convert to percentage
}

async function getRamUsage() {
    const memoryInfo = await si.mem();
    return memoryInfo.active / (1024 * 1024); // Convert to MB
}

async function getDiskUsage() {
    const diskInfo = await si.fsSize();
    return diskInfo[0].used / (1024 * 1024 * 1024); // Convert to GB
}

async function insertDataIntoMongoDB(cpuUsage, memoryUsage, ramUsage, diskUsage) {
    const db = client.db('monitor');
    const collection = db.collection('usage');
    
    // Clear existing data from the collection
    await collection.deleteMany({});

    // Insert new data into MongoDB
    const usage = {
        timestamp: Date.now(),
        cpu_usage: cpuUsage,
        memory_usage: memoryUsage,
        ram_usage: ramUsage,
        disk_usage: diskUsage
    };
    await collection.insertOne(usage);
    console.log('Data inserted into MongoDB:', usage);
}

async function retrieveDataFromMongoDB() {
    const db = client.db('monitor');
    const collection = db.collection('usage');
    return await collection.find().toArray();
}

async function detectAnomaly(cpuUsage, memoryUsage, ramUsage, diskUsage) {
    let cpuWarning = '';
    let memoryWarning = '';
    let ramWarning = '';
    let diskWarning = '';

    if (cpuUsage > 50) {
        console.log('Anomaly detected: High CPU Usage');
        cpuWarning = 'Warning!';
    }

    if (memoryUsage > 80) {
        console.log('Anomaly detected: High Memory Usage');
        memoryWarning = 'Warning!';
    }

    if (ramUsage > 7000) {
        console.log('Anomaly detected: High RAM Usage');
        ramWarning = 'Warning!';
    }

    if (diskUsage > 80) {
        console.log('Anomaly detected: High Disk Usage');
        diskWarning = 'Warning!';
    }

    return { cpuWarning, memoryWarning, ramWarning, diskWarning };
}





async function clearCache() {
    return new Promise((resolve, reject) => {
        exec('sync && echo 3 > /proc/sys/vm/drop_caches', (error, stdout, stderr) => {
            if (error) {
                console.error('Error clearing cache:', error);
                reject(error);
            } else {
                console.log('Cache cleared successfully');
                resolve();
            }
        });
    });
}

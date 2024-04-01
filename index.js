require('dotenv').config();
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const axios = require('axios');
const md5 = require('md5');

const targetWebsiteFilePath = './TargetWebsites.txt';
const proxyList = './ProxyList.txt';

const getRandomInteger = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const waitForDefinedSeconds = async duration => await new Promise(resolve, setTimeout(resolve, duration));

const readFileLines = async (filePath) => {
    try {
        const fileContent = await fs.promises.readFile(filePath, 'utf-8');
        const lines = fileContent.split('\r\n');
        const nonEmptyLines = lines.filter(line => line.trim() !== '');
        return nonEmptyLines;
    } catch (error) {
        console.log(error)
    }
};

const getToken = async (email, password) => {
    const obj = {
        email: email,
        password: md5(password)
    };
    const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `https://api.multilogin.com/user/signin`,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        data: JSON.stringify(obj)
    };
    try {
        const { data } = await axios(config);
        return data;
    } catch (error) {
        const { response: { data } } = error;
        return data;
    }
}

const startProfile = async (token, proxy) => {
    const [proxyHost, proxyPort, proxyProtocol, proxyUsername, proxyPassword] = proxy.split(':');
    const browserTypes = ["mimic", "stealthfox"];
    const osTypes = ["linux", "macos", "windows"];
    const obj = {
        browser_type: browserTypes[getRandomInteger(0, 1)],
        os_type: osTypes[getRandomInteger(0, 2)],
        automation: "puppeteer",
        proxy: {
            host: proxyHost.trim(),
            type: proxyProtocol.trim().toLowerCase(),
            port: Number(proxyPort),
            username: proxyUsername.trim(),
            password: proxyPassword.trim()
        },
        parameters: {
            fingerprint: {
                cmd_params: {
                    params: [
                        {
                            flag: "disable-notifications",
                            value: "true"
                        }
                    ]
                }
            },
            flags: {
                audio_masking: "natural",
                fonts_masking: "mask",
                geolocation_masking: "mask",
                geolocation_popup: "allow",
                graphics_masking: "natural",
                graphics_noise: "natural",
                localization_masking: "mask",
                media_devices_masking: "natural",
                navigator_masking: "mask",
                ports_masking: "natural",
                proxy_masking: "custom",
                screen_masking: "natural",
                timezone_masking: "mask",
                webrtc_masking: "mask"
            }
        }
    };
    const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: "https://launcher.mlx.yt:45001/api/v2/profile/quick",
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        data: JSON.stringify(obj)
    }
    try {
        const { status, data } = await axios(config);
        const { message, http_code } = status;

        if (message === 'browser profile failed to start') {
            console.log('Try again after a minute..');
            return { port: null, check: false };
        } else if (message === 'proxy creation error' || message === "couldn't get proxy connection ip data") {
            return { port: null, check: false };
        } else if (message === "unauthorized") {
            console.log("401 - Unauthorized, possibly too many requests or need a new token.");
            return { port: null, check: false };
        } else if (http_code !== 200) {
            console.log(data);
        } else {
            const { data: { port } } = data;
            return { port, check: true };
        }
    } catch (error) {
        console.error(error.response.data);
        return { port: null, check: false };
    }
}

const app = async () => {
    const targetWebsites = await readFileLines(targetWebsiteFilePath);
    const proxies = await readFileLines(proxyList);
    const email = process.env.EMAIL;
    const password = process.env.PASSWORD;
    const { status, data } = await getToken(email, password);
    if (status.http_code === 200) {
        for (let i = 0; i < targetWebsites.length; i++) {
            try {
                const targetWebsite = targetWebsites[i];
                const proxy = proxies[i % proxies.length];
                const { token } = data;
                const { port, check } = await startProfile(token, proxy);
                if (check) {
                    const ws = `http://127.0.0.1:${port}`;
                    const browser = await puppeteer.connect({ browserWSEndpoint: ws, defaultViewport: null });
                    console.log(browser);
                } else {
                    console.log('Proxy failed..');
                    continue;
                }
            } catch (error) {
                console.log(error);
            }
        }
    } else {
        console.log('Getting token error..');
    }
}

app();
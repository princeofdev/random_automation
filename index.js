require('dotenv').config();
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const axios = require('axios');
const md5 = require('md5');

const targetWebsiteFilePath = './TargetWebsites.txt';
const proxyList = './ProxyList.txt';

const getRandomInteger = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const waitForDefinedSeconds = async duration => await new Promise(resolve => setTimeout(resolve, duration));

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
        const { data: { data: { port } } } = await axios(config);
        return { port, proxyUsername, proxyPassword, check: true };
    } catch (error) {
        console.log('Keep working...');
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
                const { port, proxyUsername, proxyPassword, check } = await startProfile(token, proxy);
                if (check) {
                    const connect = `http://127.0.0.1:${port}`;
                    let browser = null;
                    try {
                        browser = await puppeteer.connect({ browserURL: connect, defaultViewport: null });
                        const page = await browser.newPage();
                        await page.authenticate({
                            username: proxyUsername,
                            password: proxyPassword
                        });
                        const dimensions = await page.evaluate(() => {
                            return {
                                width: window.innerWidth,
                                height: window.innerHeight
                            };
                        });
                        console.log(dimensions);
                        await page.goto(`http://${targetWebsite}`);
                        await page.waitForFunction(() => {
                            return document.readyState === 'complete';
                        });
                        const duration = getRandomInteger(10000, 60000);
                        await waitForDefinedSeconds(duration);
                        // move
                        const numSteps = 50;
                        for (let i = 0; i < numSteps; i++) {
                            const randomX = Math.floor(Math.random() * dimensions.width);
                            const randomY = Math.floor(Math.random() * dimensions.height);
                            console.log(randomX, randomY);
                            await page.mouse.move(randomX, randomY);
                            await waitForDefinedSeconds(100);
                        }
                        await page.evaluate(() => {
                            window.scrollBy(0, window.innerHeight);
                        });
                        await waitForDefinedSeconds(1000);
                        await browser.close();
                    } catch (error) {
                        if (browser) {
                            await browser.close();
                        }
                    }
                } else {
                    continue;
                }
            } catch (error) {
                console.log('Next');
            }
        }
    } else {
        console.log('Getting token error..');
    }
}

app();
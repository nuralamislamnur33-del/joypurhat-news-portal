require('dotenv').config();
const express = require('express');
const { Octokit } = require("@octokit/rest");
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const app = express();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// ১. কনফিগারেশন
cloudinary.config({ 
    cloud_name: process.env.CLOUD_NAME, 
    api_key: process.env.CLOUD_KEY, 
    api_secret: process.env.CLOUD_SECRET 
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: 'news_media', resource_type: 'auto' }
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

// গিটহাব থেকে ডেটা আনার ফাংশন
async function getNewsFromGitHub() {
    const { data } = await octokit.repos.getContent({
        owner: process.env.REPO_OWNER,
        repo: process.env.REPO_NAME,
        path: 'data.json'
    });
    return JSON.parse(Buffer.from(data.content, 'base64').toString());
}

// গিটহাবে ডেটা সেভ করার ফাংশন
async function saveToGitHub(newsData) {
    const { data: fileData } = await octokit.repos.getContent({
        owner: process.env.REPO_OWNER,
        repo: process.env.REPO_NAME,
        path: 'data.json'
    });

    await octokit.repos.createOrUpdateFileContents({
        owner: process.env.REPO_OWNER,
        repo: process.env.REPO_NAME,
        path: 'data.json',
        message: 'Update news data',
        content: Buffer.from(JSON.stringify(newsData, null, 2)).toString('base64'),
        sha: fileData.sha
    });
}

// ৩. রুটসমূহ
app.get('/api/news', async (req, res) => {
    try {
        const news = await getNewsFromGitHub();
        const updatedNews = news.map(n => ({...n, views: (n.views || 0) + 1}));
        await saveToGitHub(updatedNews);
        res.json(updatedNews);
    } catch (err) { res.status(500).send("ডাটা লোড করতে সমস্যা"); }
});

app.post('/api/news', upload.single('media'), async (req, res) => {
    if (req.body.password !== process.env.ADMIN_PASS) return res.status(403).send("ভুল পাসওয়ার্ড!");
    try {
        let news = await getNewsFromGitHub();
        news.push({
            id: Date.now(),
            title: req.body.title,
            content: req.body.content,
            media: req.file ? req.file.path : null,
            date: new Date().toLocaleDateString('bn-BD'),
            views: 0,
            likes: 0
        });
        await saveToGitHub(news);
        res.redirect('/');
    } catch (err) { res.status(500).send("পোস্ট করতে সমস্যা"); }
});

app.post('/api/update/like/:id', async (req, res) => {
    try {
        let news = await getNewsFromGitHub();
        let post = news.find(n => n.id == req.params.id);
        if(post) {
            post.likes = (post.likes || 0) + 1;
            await saveToGitHub(news);
        }
        res.send({ success: true });
    } catch (err) { res.status(500).send("লাইক আপডেট করতে সমস্যা"); }
});

app.delete('/api/news/:id', async (req, res) => {
    if (req.body.password !== process.env.ADMIN_PASS) return res.status(403).send("ভুল পাসওয়ার্ড!");
    try {
        let news = await getNewsFromGitHub();
        news = news.filter(n => n.id != req.params.id);
        await saveToGitHub(news);
        res.send({ success: true });
    } catch (err) { res.status(500).send("ডিলিট করতে সমস্যা"); }
});

app.listen(process.env.PORT || 5050, () => console.log('সার্ভার লাইভ হয়েছে!'));
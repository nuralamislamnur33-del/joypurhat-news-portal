require('dotenv').config();
const express = require('express');
const fs = require('fs');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const app = express();

// ১. কনফিগারেশন
cloudinary.config({ 
    cloud_name: process.env.CLOUD_NAME, 
    api_key: process.env.CLOUD_KEY, 
    api_secret: process.env.CLOUD_SECRET 
});

// ২. ক্লাউড স্টোরেজ সেটআপ
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: 'news_media', resource_type: 'auto' }
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // ফর্ম ডাটা রিড করার জন্য
app.use(express.static('.'));

const DATA_FILE = './data.json';

// ফাইল না থাকলে তৈরি করা
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// ৩. রুটসমূহ
// নিউজ পাওয়ার রুট
app.get('/api/news', (req, res) => {
    try {
        const news = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        // ভিউ বাড়ানো (প্রতিবার লোড হলে ভিউ ১ বাড়বে)
        const updatedNews = news.map(n => ({...n, views: (n.views || 0) + 1}));
        fs.writeFileSync(DATA_FILE, JSON.stringify(updatedNews, null, 2));
        res.json(updatedNews);
    } catch (err) {
        res.status(500).send("ডাটা রিড করতে সমস্যা হয়েছে");
    }
});

// নিউজ পোস্ট করার রুট
app.post('/api/news', upload.single('media'), (req, res) => {
    if (req.body.password !== process.env.ADMIN_PASS) return res.status(403).send("ভুল পাসওয়ার্ড!");
    
    try {
        let news = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        news.push({
            id: Date.now(),
            title: req.body.title,
            content: req.body.content,
            media: req.file ? req.file.path : null,
            date: new Date().toLocaleDateString('bn-BD'),
            views: 0,
            likes: 0
        });
        fs.writeFileSync(DATA_FILE, JSON.stringify(news, null, 2));
        res.redirect('/');
    } catch (err) {
        res.status(500).send("পোস্ট করতে সমস্যা হয়েছে");
    }
});

// লাইক দেওয়ার রুট
app.post('/api/update/like/:id', (req, res) => {
    try {
        let news = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        let post = news.find(n => n.id == req.params.id);
        if(post) {
            post.likes = (post.likes || 0) + 1;
            fs.writeFileSync(DATA_FILE, JSON.stringify(news, null, 2));
        }
        res.send({ success: true });
    } catch (err) {
        res.status(500).send("লাইক আপডেট করতে সমস্যা হয়েছে");
    }
});

// ডিলিট করার রুট
app.delete('/api/news/:id', (req, res) => {
    if (req.body.password !== process.env.ADMIN_PASS) return res.status(403).send("ভুল পাসওয়ার্ড!");
    
    try {
        let news = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        news = news.filter(n => n.id != req.params.id);
        fs.writeFileSync(DATA_FILE, JSON.stringify(news, null, 2));
        res.send({ success: true });
    } catch (err) {
        res.status(500).send("ডিলিট করতে সমস্যা হয়েছে");
    }
});

app.listen(process.env.PORT || 5050, () => console.log('সার্ভার চলছে http://localhost:5050'));
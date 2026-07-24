import fetch from 'node-fetch';

async function testUpload() {
  try {
    const base64Data = 'data:image/jpeg;base64,' + Buffer.from('test image data').toString('base64');
    const res = await fetch('http://localhost:3000/api/drive/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'test.jpg',
        base64Data,
        folderPath: ['test_folder']
      })
    });
    
    console.log(res.status, await res.text());
  } catch (error) {
    console.error(error);
  }
}

testUpload();

# [Lego-Art-Remix.com](https://lego-art-remix.com/)

The Intelligent, Easy to Use Lego Mosaic Maker

This project is not affiliated with The Lego Group

Made with ♥ by Deb

### Media

These are some articles and videos featuring Lego Art Remix. Note that some were published when the tool was older.

- [#LegoArtRemix on Instagram](https://www.instagram.com/explore/tags/legoartremix/)
- [Global News Morning Segment](https://globalnews.ca/video/7439079/you-can-store-your-medical-records-on-this-app)
- [Brothers Brick Article](https://www.brothers-brick.com/2020/08/27/create-your-own-mosaic-masterpiece-with-lego-art-remix-review-interview/) (2020 Top 3 most popular feature)
- [TheBrickBlogger Article](http://thebrickblogger.com/2020/12/building-custom-lego-mosaics-with-lego-art-sets/)
- [DuckBricks Video](https://www.youtube.com/watch?v=RY4OJnD99VQ)

![Lego Art Meta Picture](https://raw.githubusercontent.com/debkbanerji/lego-art-remix/master/app/assets/png/icon-960x960.png)

## What is it?

In 2020, The Lego Group released the [Lego Art](https://www.lego.com/en-us/campaigns/art) theme, which allows people to create a predetermined image using Lego studs.

Lego Art Remix lets you upload your own image, and then uses computer vision to use the studs from a Lego Art set that you already have to recreate the image.

## Performance and Security

The computer vision techniques used are pretty inexpensive (with the exception of optional depth map generation), and the resolutions being dealt with are naturally quite low, so as of the time of writing, the algorithm runs quite quickly. This allows for it to be run on the client, and on the machines that I tested, it ran in near real time.

The most computationally expensive part of the process, apart from depth map generation, is generating the instructions, since even pdf generation is done client side.

Since it runs almost entirely within the browser, no image data is sent to a server and so it's very secure. This also makes it much easier for me to maintain and host. The only server code consists of simple increments to anonymously estimate usage, for the purposes for tracking performance in case the static deployment needs to be scaled up, and for the counter in the about section.

Even the deep neural network to compute depth maps is being run entirely within the browser, in a web worker, using a modified version of [ONNX.js](https://github.com/microsoft/onnxjs). I've compiled a version of the library based on [this](https://github.com/microsoft/onnxjs/pull/228) pull request, with a small additional change I made to support the resize operation in v10. The model used is [MiDaS](https://github.com/intel-isl/MiDaS) - more specifically, the small ONNX version which can be found [here](https://github.com/intel-isl/MiDaS/releases/tag/v2_1).

### Citation for model used

Ranftl, René, Katrin Lasinger, David Hafner, Konrad Schindler, and Vladlen Koltun. "Towards robust monocular depth estimation: Mixing datasets for zero-shot cross-dataset transfer." (2020). _IEEE Transactions on Pattern Analysis and Machine Intelligence_

## Bugs, Feature Requests, and Algorithm Improvements

_Direct any concerns or ideas for improvements to the [issues tab](https://github.com/debkbanerji/lego-art-remix/issues)_

As of the time of writing, I don't have all of the sets, and I haven't had much time to test. As a result, there's probably a few bugs, so let me know if you find any.

Algorithm improvement ideas are always welcome. Improvements that maintain the efficiency to within a reasonable degree would allow the algorithm to keep running on the client, which I really like.

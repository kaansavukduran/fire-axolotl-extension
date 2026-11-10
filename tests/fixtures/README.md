`video.webm` is an original synthetic two-second solid-color test fixture, with no audio or third-party footage. It is licensed with the repository code. Regenerate with:

```sh
ffmpeg -f lavfi -i color=c=0x12375c:s=320x180:r=10 -t 2 -an -c:v libvpx -b:v 40k -y video.webm
```

It is a normal recorded video rather than a live MediaStream, since live-stream playback speed can be fixed by the browser.

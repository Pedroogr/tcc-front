# Modelo de pose da estação de gestos

A estação usa o checkpoint `yolo11n-pose.pt` da Ultralytics. O vídeo é
processado no navegador; o arquivo ONNX não
é enviado à API e a API não recebe os frames contínuos.

## Artefato distribuído

- Arquivo: `public/models/yolo11n-pose.onnx`
- Tamanho: `11.853.515` bytes
- SHA-256: `42b7471c9df92c3fa39cf5259539d90ad2a19eea112d71bfd858a57fa2314ca5`
- Entrada: `images`, `float32[1,3,640,640]`
- Saída: `output0`, `float32[1,56,8400]`
- Keypoints: COCO Pose, `17 x (x, y, confiança)`
- Licença registrada no modelo: `AGPL-3.0`

## Exportação reproduzível

A exportação foi validada com a imagem oficial e versionada da Ultralytics:

- imagem: `ultralytics/ultralytics:8.4.165-python-export`
- digest: `sha256:2b06f17a612266ea5924ac6659865daa6181f5f07a712367ae9e5d43d51296e2`
- Ultralytics: `8.4.165`
- ONNX: `1.23.0`
- opset: `17`

No diretório que contém o checkpoint, execute:

```powershell
docker run --rm -v "${PWD}:/workspace" -w /workspace `
  ultralytics/ultralytics:8.4.165-python-export `
  yolo export model=yolo11n-pose.pt format=onnx imgsz=640 `
  dynamic=False simplify=True opset=17
```

O exportador produziu um grafo estático sem NMS embutido. O frontend faz
letterbox, filtragem por confiança, NMS e conversão dos keypoints de volta ao
espaço do frame.

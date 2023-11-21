<p align="center">
  <img src="https://github.com/5sControl/.github/assets/131950264/d65c5be1-1cca-46a1-b564-ef4364f0dbc6" alt="5controlS" height = "320" />
</p>

[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

**[5controlS](https://5controls.com/)** is a video monitoring system with AI analysis and ERP Integration (Open Source) that helps companies improve productivity, eliminate waste, and enhance workplace safety using computer vision (CV) and machine learning (ML). 

The platform generates detailed reports to provide insights on how processes can be optimized.

Plug-in your ML-algorithms or some of the Official 5s algorithms and get a ready-to-use software for manufacturing monitoring.

# **Project repositories**

The connections between the project repositories are illustrated by the following diagram. 

> Please note that to ensure system stability and perfomance you can use one of the Official 5S algorithms instead of Your Algorithm.

<p align="center">
  <img src="https://github.com/5sControl/5s-user-documentation/blob/main/assets/5S%20scheme%20(1).png" alt="5controlS-diagram" />
</p>


**5controlS Platform:**
1. [5s-webserver](https://github.com/5sControl/5s-webserver)
2. [5s-backend](https://github.com/5sControl/5s-backend)
3. [5s-frontend](https://github.com/5sControl/5s-frontend)
4. [5s-algorithms-controller](https://github.com/5sControl/5s-algorithms-controller)
5. [5s-onvif](https://github.com/5sControl/5s-onvif)
6. [5s-onvif-finder](https://github.com/5sControl/5s-onvif-finder)
 
**Official Algorithms:**
1. [min-max](https://github.com/5sControl/min-max)
2. [idle-control](https://github.com/5sControl/idle-control)
3. [operation-control-js](https://github.com/5sControl/operation-control-js)
4. [machine-control](https://github.com/5sControl/machine-control)
5. [machine-control-js](https://github.com/5sControl/machine-control-js)

**Algorithms Servers:**
1. [inference-server-js](https://github.com/5sControl/inference-server-js)

# **Documentation**

[Documentation for Developers](https://github.com/5sControl/5s-dev-documentation/wiki)

[User Documentation](https://github.com/5sControl/Manufacturing-Automatization-Enterprise/wiki)

[Installation Guide Pt.1](https://5controls.com/blog/installing-5s-control-software)

[Installation Guide Pt.2](https://5controls.com/blog/installing-5s-control-software-part-2-docker)

# **Installation**
To run the application, you need to install Docker. You can do this by following the instructions specific to your system available at [Docker Installation Guide](https://docs.docker.com/engine/install/).

Please follow the link and select the instructions that match your operating system to install Docker.

To clone the project, use the following Git command:

```shell
git@github.com:5sControl/5s-algorithms-controller.git
```

 **Install Dependencies:**

Install all project dependencies, run the following command using npm:
```shell
npm install
```

 **Create a .env File:**

In the root directory of your project, create a file named .env. You can do this manually or by using command-line text editors like touch or echo (for Unix-based systems) or any text editor of your choice.

For Unix-based systems using the touch command:
```shell
touch .env
```
**Environment Variables:**

You can reference an example of the environment variables in the `.env.example` file. Here is how they should be defined:

- `IP`: The address of your host. Example: `'192.168.1.101'`
- `ALGORITHMS_SOURCE_IMAGES_DIST`: The location where you will store algorithm images. Example: `'/media/server/static/images'`
- `ALGORITHMS_SOURCE_DEBUG_DIST`: The location where debug photos are stored. Example: `'/media/server/static/debug'`
- `ALGORITHMS_TARGET_IMAGES_DIST`: The mount point for algorithm images in Docker. Example: `'/var/www/5scontrol/images'`
- `ALGORITHMS_TARGET_DEBUG_DIST`: The mount point for debug photos in Docker. Example: `'/var/www/5scontrol/debug'`

Make sure to create your `.env` file and define these variables with the appropriate values for your project.

**Running the Application:**

- For development, use the following command: `npm run dev`.

- For start, use the following command: `npm run start`.

# **Contributing**
Thank you for considering contributing to 5controlS. We truly believe that we can build an outstanding product together!

We welcome a variety of ways to contribute. Read below to learn how you can take part in improving 5controlS.

## **Code of conduct**

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## Code contributing

If you want to contribute, read  our [contributing guide](CONTRIBUTING.md) to learn about our development process and pull requests workflow.

We also have a list of [good first issues](https://github.com/5sControl/5s-algorithms-controller/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) that will help you make your first step to beсoming a 5S contributor.

# **License**

[GNU GPL-3.0](LICENSE)

> 5controlS uses third party libraries that are distributed under their own terms (see [LICENSE-3RD-PARTY.md](https://github.com/5sControl/5s-algorithms-controller/blob/main/LICENSE-3RD-PARTY.md)).<br>

<br>
<div align="center">
  <a href="https://5controls.com/" style="text-decoration:none;">
    <img src="https://github.com/5sControl/Manufacturing-Automatization-Enterprise/blob/3bafa5805821a34e8b825df7cc78e00543fd7a58/assets/Property%201%3DVariant4.png" width="10%" alt="" /></a> 
  <img src="https://github.com/5sControl/5s-backend/assets/131950264/d48bcf5c-8aa6-42c4-a47d-5548ae23940d" width="3%" alt="" />
  <a href="https://github.com/5sControl" style="text-decoration:none;">
    <img src="https://github.com/5sControl/Manufacturing-Automatization-Enterprise/blob/3bafa5805821a34e8b825df7cc78e00543fd7a58/assets/github.png" width="4%" alt="" /></a>
  <img src="https://github.com/5sControl/5s-backend/assets/131950264/d48bcf5c-8aa6-42c4-a47d-5548ae23940d" width="3%" alt="" />
  <a href="https://www.youtube.com/@5scontrol" style="text-decoration:none;">
    <img src="https://github.com/5sControl/Manufacturing-Automatization-Enterprise/blob/ebf176c81fdb62d81b2555cb6228adc074f60be0/assets/youtube%20(1).png" width="5%" alt="" /></a>
</div>

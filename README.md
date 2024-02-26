# Blade Runner Automation

Welcome to the **Blade Runner Automation** repository! This repository contains helper functions and scripts written in TypeScript to facilitate the automation of AT300 processing blades. If you're working with AT300 blades and looking to streamline your automation processes, you're in the right place.

## Features

- **Helper Functions:** Includes a collection of TypeScript helper functions tailored for AT300 processing blades.
- **Scripts:** Pre-written scripts for common automation tasks, helping you save time and effort in your workflow.

## Getting Started

To get started with Blade Runner Automation, follow these steps:

1. **Clone the Repository:**

   ```
   git clone https://github.com/arkona-technologies/blade-runner-automation.git
   ```

2. **Install Dependencies:**

   ```
   npm install
   ```

3. **Usage:**

   - Utilize the provided helper functions and scripts in your TypeScript projects.
   - Refer to the documentation and comments within the code for usage instructions and examples.

4. **Configuration:**
   - The pre-made scripts use environment variables for configuration.
   - Copy the example `.env` file provided in the repository and customize it according to your needs.

## Examples

### Base Setup

This will Reset the Blade, ensure the loaded Application is _AVP_100GbE_ and lock PTP-Clock
and Genlock to PTP-Domain 127

```
URL_BLADE=http://172.16.210.107 FPGA=AVP_100GbE PTP_DOMAIN=127 node --loader ts-node/esm src/base.ts
```

### SDI->IP

Expecting a previously configured Blade, this will Stream the supplied SDI Input (in this case 0)
to 2110-20 and stream it's embedded audio via a configurable
amount (in this example 4) transmitters to 2110-30.

```
URL_BLADE=http://172.16.210.107 SDI_INDEX=0 NUM_AUDIO=4 node --loader ts-node/esm src/sdi_ip.ts
```

### Set Transmitter Multicast Addresses

Assuming N Transmitters have been set up we may want to change their destination multicast addresses in one move. The supplied _set_addresses_from_csv_
Function may be used to utilize a .csv file for easy addresss assignment. An example .csv file describing the layout can be found in this repository.

For Example:

```
URL_BLADE=http://172.16.210.107 CSV_PATH=/path/to/some/file.csv node --loader ts-node/esm src/addresses.ts
```

## Contributing

Contributions to Blade Runner Automation are welcome! If you have improvements, bug fixes, or new features to contribute, please follow these steps:

1. Fork the repository.
2. Create a new branch for your changes.
3. Make your modifications.
4. Test your changes thoroughly.
5. Submit a pull request with a clear description of your changes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- The Blade Runner Automation project is maintained by Arkona Technologies.
- Special thanks to the contributors who have helped improve this project.

## Contact

For any questions, concerns, or feedback, feel free to reach out to us at [contact@arkona-technologies.com](mailto:contact@arkona-technologies.com).

Happy automating! 🤖🚀
